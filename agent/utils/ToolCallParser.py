"""
Parser: turn a JSON- or Python-dict-style string (as commonly emitted by
LLMs for tool-call arguments) into a real Python dict/list, recursively.

By default every nested object/array is parsed all the way down, just
like json.loads -- including the common case where a tool call wraps a
nested structure as a *string* instead of embedding it directly, e.g.

    {"arguments": "{'runnerId': 0, 'code': 'print(\\"hi\\")'}"}

Here `"arguments"` is, structurally, a plain JSON string -- but since its
decoded content itself looks like an object (`{...}`), Parser parses
that one level further automatically, so you get a real nested dict back
without having to detect and re-parse it yourself.

The one thing you can opt out of, per field name, is exactly that
auto-recursion -- e.g. a `code` field whose text might legitimately
start with `{` or `[` (a dict/list literal as source code) but should
stay a plain string no matter what it looks like. List that field name
in `raw_fields` and its value is always left as the decoded string,
never parsed further, however object/array-ish it looks.

    >>> p = Parser(raw_fields={"code"})
    >>> p.parse('{"arguments": "{\\'runnerId\\': 0, \\'code\\': \\'print(\\\\"hello world\\\\")\\'}"}')
    {'arguments': {'runnerId': 0, 'code': 'print("hello world")'}}

Everything else -- objects, arrays, quoted strings, numbers, booleans,
null/None -- is parsed and converted to native Python values as usual.
"""


class ParseError(Exception):
    """Raised when the input cannot be parsed safely."""


class ToolCallParser:
    _WS = ' \t\r\n'

    def __init__(self, raw_fields=None):
        """
        raw_fields: an iterable of dict-key names whose values should be
        left completely untouched (returned as the exact raw source
        text, quotes stripped for plain strings) instead of being
        recursively parsed or escape-decoded. Useful for fields like
        "code" that may contain arbitrary, hard-to-safely-reparse text.
        """
        self.raw_fields = set(raw_fields or ())

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def parse(self, text):
        if not isinstance(text, str):
            raise ParseError(f"Input must be a string, got {type(text)!r}")
        s = text.strip()
        if not s:
            raise ParseError("Empty input")
        if s[0] == '{':
            value, end = self._parse_object(s, 0)
        elif s[0] == '[':
            value, end = self._parse_array(s, 0)
        else:
            raise ParseError(
                f"Top-level input must start with '{{' or '[', got: {s[:30]!r}"
            )
        end = self._skip_ws(s, end)
        if end != len(s):
            raise ParseError(
                "Unexpected trailing content after top-level value at "
                f"index {end}: {s[end:end + 30]!r}"
            )
        return value

    # ------------------------------------------------------------------
    # low level scanning helpers
    # ------------------------------------------------------------------

    def _skip_ws(self, s, i):
        n = len(s)
        while i < n and s[i] in self._WS:
            i += 1
        return i

    def _skip_string_raw(self, s, i):
        """
        s[i] is a quote character. Return the index just past the
        matching closing quote WITHOUT decoding the content. A
        backslash always protects the very next character, so an
        escaped quote of the same type never closes the string early,
        and a quote of the *other* type is just ordinary content.
        """
        quote = s[i]
        n = len(s)
        j = i + 1
        while j < n:
            c = s[j]
            if c == '\\':
                j += 2  # skip the backslash AND whatever it escapes
                continue
            if c == quote:
                return j + 1
            j += 1
        raise ParseError(
            f"Unterminated string starting at index {i} (quote {quote!r})"
        )

    def _find_matching_bracket(self, s, i):
        """
        s[i] is '{' or '['. Return the index just past the matching
        closing bracket. Quoted strings encountered along the way are
        treated as opaque -- their internal braces/brackets/quotes are
        skipped over, never counted.
        """
        open_ch = s[i]
        close_ch = '}' if open_ch == '{' else ']'
        depth = 0
        n = len(s)
        j = i
        while j < n:
            c = s[j]
            if c == '"' or c == "'":
                j = self._skip_string_raw(s, j)
                continue
            if c in '{[':
                depth += 1
                j += 1
            elif c in '}]':
                depth -= 1
                j += 1
                if depth == 0:
                    return j
            else:
                j += 1
        raise ParseError(
            f"Unterminated '{open_ch}' starting at index {i}: "
            f"no matching '{close_ch}' found"
        )

    def _decode_string(self, s, i):
        """
        s[i] is an opening quote. Decode escape sequences and return
        (decoded_str, index_after_closing_quote). Standard escapes
        (\\n \\t \\r \\b \\f \\\\ \\/ \\uXXXX, and an escaped matching
        quote) become real characters. Any other backslash sequence
        (e.g. \\d, \\s from a regex) is preserved exactly as-is rather
        than guessed at.
        """
        quote = s[i]
        n = len(s)
        j = i + 1
        out = []
        while j < n:
            c = s[j]
            if c == '\\':
                if j + 1 >= n:
                    raise ParseError(
                        f"Dangling escape at end of string starting at {i}"
                    )
                nxt = s[j + 1]
                if nxt == quote:
                    out.append(quote); j += 2
                elif nxt == '\\':
                    out.append('\\'); j += 2
                elif nxt == 'n':
                    out.append('\n'); j += 2
                elif nxt == 't':
                    out.append('\t'); j += 2
                elif nxt == 'r':
                    out.append('\r'); j += 2
                elif nxt == 'b':
                    out.append('\b'); j += 2
                elif nxt == 'f':
                    out.append('\f'); j += 2
                elif nxt == '/':
                    out.append('/'); j += 2
                elif nxt == 'u' and j + 5 < n and all(
                    ch in '0123456789abcdefABCDEF' for ch in s[j + 2:j + 6]
                ):
                    out.append(chr(int(s[j + 2:j + 6], 16)))
                    j += 6
                else:
                    out.append('\\')
                    out.append(nxt)
                    j += 2
                continue
            if c == quote:
                return ''.join(out), j + 1
            out.append(c)
            j += 1
        raise ParseError(f"Unterminated string starting at index {i}")

    def _parse_scalar(self, s, i):
        n = len(s)
        j = i
        while j < n and s[j] not in ',}]' and s[j] not in self._WS:
            j += 1
        token = s[i:j]
        if token == '':
            raise ParseError(f"Expected a value at index {i}, found nothing")
        low = token.lower()
        if low == 'true':
            return True, j
        if low == 'false':
            return False, j
        if low in ('null', 'none'):
            return None, j
        try:
            return int(token), j
        except ValueError:
            pass
        try:
            return float(token), j
        except ValueError:
            pass
        raise ParseError(f"Could not parse scalar token {token!r} at index {i}")

    def _parse_value(self, s, i, raw=False):
        """
        Parse a single value at s[i].
          raw=False (default): objects/arrays recurse into real
            dict/list.
          raw=True: an object/array is returned as its exact raw
            source text instead of being recursed into.
        A quoted string is always escape-decoded into its real string
        content either way -- that already *is* "not parsed as
        structure", so raw only changes what happens for `{...}`/`[...]`
        shaped values.
        Returns (value, end_index).
        """
        i = self._skip_ws(s, i)
        if i >= len(s):
            raise ParseError("Unexpected end of input while expecting a value")
        c = s[i]
        if c in '{[':
            end = self._find_matching_bracket(s, i)
            substring = s[i:end]
            if raw:
                return substring, end
            if c == '{':
                value, _ = self._parse_object(substring, 0)
            else:
                value, _ = self._parse_array(substring, 0)
            return value, end
        if c == '"' or c == "'":
            value, end = self._decode_string(s, i)
            if not raw:
                # A string whose *decoded content* itself looks like an
                # object/array (this happens when a tool call wraps a
                # nested structure as a JSON/Python-dict string instead
                # of embedding it directly, e.g.
                # {"arguments": "{'runnerId': 0, 'code': '...'}"} ) gets
                # parsed one level further automatically, so callers
                # don't have to detect and re-parse it by hand. If it
                # only superficially looks like one but doesn't actually
                # parse, it's left as the plain string.
                stripped = value.strip()
                if stripped[:1] in ('{', '['):
                    try:
                        value = self.parse(stripped)
                    except ParseError:
                        pass
            return value, end
        return self._parse_scalar(s, i)

    # ------------------------------------------------------------------
    # object / array parsing
    # ------------------------------------------------------------------

    def _parse_object(self, s, i):
        assert s[i] == '{'
        i += 1
        result = {}
        i = self._skip_ws(s, i)
        if i < len(s) and s[i] == '}':
            return result, i + 1
        while True:
            i = self._skip_ws(s, i)
            if i >= len(s) or s[i] not in '"\'':
                raise ParseError(
                    f"Expected a quoted string key at index {i}: "
                    f"{s[i:i + 20]!r}"
                )
            key, i = self._decode_string(s, i)
            i = self._skip_ws(s, i)
            if i >= len(s) or s[i] != ':':
                raise ParseError(f"Expected ':' after key {key!r} at index {i}")
            i += 1
            value, i = self._parse_value(s, i, raw=(key in self.raw_fields))
            result[key] = value
            i = self._skip_ws(s, i)
            if i >= len(s):
                raise ParseError("Unterminated object: expected ',' or '}'")
            if s[i] == ',':
                i += 1
                i = self._skip_ws(s, i)
                if i < len(s) and s[i] == '}':  # tolerate trailing comma
                    return result, i + 1
                continue
            if s[i] == '}':
                return result, i + 1
            raise ParseError(f"Expected ',' or '}}' at index {i}: {s[i:i + 20]!r}")

    def _parse_array(self, s, i):
        assert s[i] == '['
        i += 1
        result = []
        i = self._skip_ws(s, i)
        if i < len(s) and s[i] == ']':
            return result, i + 1
        while True:
            i = self._skip_ws(s, i)
            value, i = self._parse_value(s, i, raw=False)
            result.append(value)
            i = self._skip_ws(s, i)
            if i >= len(s):
                raise ParseError("Unterminated array: expected ',' or ']'")
            if s[i] == ',':
                i += 1
                i = self._skip_ws(s, i)
                if i < len(s) and s[i] == ']':
                    return result, i + 1
                continue
            if s[i] == ']':
                return result, i + 1
            raise ParseError(f"Expected ',' or ']' at index {i}: {s[i:i + 20]!r}")