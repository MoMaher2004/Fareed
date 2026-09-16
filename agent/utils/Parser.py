from termcolor import cprint

class Parser:
    AGGREGATED_TAGS = [
        'image',
        'youtube',
        'hotanswer',
        'audio',
    ]

    def __init__(self):
        self.status = 'A'

        self.tag_name = ''
        self.attribute_name = ''
        self.attribute_value = ''
        self.attributes = {}

        self.candidate_tag = ''

        self.current_type = 'text'
        self.current_attributes = {}

        self.content_buffer = ''

    def reset(self):
        self.status = 'A'

        self.tag_name = ''
        self.attribute_name = ''
        self.attribute_value = ''
        self.attributes = {}

        self.candidate_tag = ''

        self.current_type = 'text'
        self.current_attributes = {}

        self.content_buffer = ''

    def _reset_tag(self):
        self.tag_name = ''
        self.attribute_name = ''
        self.attribute_value = ''
        self.attributes = {}
        self.candidate_tag = ''

    def _add_attribute(self):
        self.attributes[self.attribute_name] = self.attribute_value

        self.attribute_name = ''
        self.attribute_value = ''

    def _flush_content(self):
        if not self.content_buffer:
            return None

        result = {
            'type': self.current_type,
            'content': self.content_buffer,
        }

        if self.current_attributes:
            result['attributes'] = self.current_attributes.copy()

        self.content_buffer = ''

        return result

    def _candidate_is_content(self, char):
        self.content_buffer += self.candidate_tag + char

        self.candidate_tag = ''
        self.status = 'A'

    def _start_new_block(self):
        self.current_type = self.tag_name.lower()
        self.current_attributes = self.attributes.copy()

        self._reset_tag()
        self.status = 'A'

    def _process_char(self, char):
        if self.status == 'A':
            if char == '<':
                self.candidate_tag += char
                self.status = 'B'
            else:
                self.content_buffer += char

        elif self.status == 'B':
            if char == '*':
                self.candidate_tag += char
                self.status = 'C'
            else:
                self._candidate_is_content(char)

        elif self.status == 'C':
            if char == '&':
                self.candidate_tag += char
                self.status = 'D'
            else:
                self._candidate_is_content(char)

        elif self.status == 'D':
            if char == '&':
                self.candidate_tag += char
                self.status = 'G'

            elif char == ':':
                self.candidate_tag += char
                self.status = 'E'

            else:
                self.candidate_tag += char
                self.tag_name += char
                self.status = 'D'

        elif self.status == 'E':
            if char == '=':
                self.candidate_tag += char
                self.status = 'F'
            else:
                self.candidate_tag += char
                self.attribute_name += char
                self.status = 'E'

        elif self.status == 'F':
            if char == '&':
                self.candidate_tag += char
                self._add_attribute()
                self.status = 'G'

            elif char == ':':
                self.candidate_tag += char
                self._add_attribute()
                self.status = 'E'

            else:
                self.candidate_tag += char
                self.attribute_value += char
                self.status = 'F'

        elif self.status == 'G':
            if char == '*':
                self.candidate_tag += char
                self.status = 'H'
            else:
                self._candidate_is_content(char)

        elif self.status == 'H':
            if char == '>':
                self.candidate_tag += char

                result = self._flush_content()

                self._start_new_block()

                return result

            else:
                self._candidate_is_content(char)

        return None

    def parse(self, chunk):
        if not isinstance(chunk, str):
            raise TypeError(
                f'Expected str chunk, got {type(chunk).__name__}'
            )

        results = []

        for char in chunk:
            result = self._process_char(char)

            if result:
                results.append(result)

        # Normal types can be emitted chunk by chunk.
        #
        # Aggregated types must stay in the buffer until
        # a new block starts.
        if self.current_type not in self.AGGREGATED_TAGS:
            result = self._flush_content()

            if result:
                results.append(result)

        return results

    def finish(self):
        """
        Flush the remaining content at the end of the stream.
        """

        result = self._flush_content()

        if result:
            return [result]

        return []

    def parse_message(self, message):
        self.reset()

        if not isinstance(message, str):
            raise TypeError(
                f'Expected str message, got {type(message).__name__}'
            )

        results = []

        for char in message:
            result = self._process_char(char)

            if result:
                results.append(result)

        # A complete message must always flush the final block.
        result = self._flush_content()

        if result:
            results.append(result)

        return results

