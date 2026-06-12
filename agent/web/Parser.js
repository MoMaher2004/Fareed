import CodeViewer from './CodeViewer.js';
import TextViewer from './TextViewer.js';
import HotAnswer from './HotAnswer.js';
import YoutubeViewer from './YoutubeViewer.js';
import AudioPlayer from './AudioPlayer.js';

class Parser {
    static blocks = [
        {
            type: "text",
            attributes: {},
            content: ""
        }
    ]

    static tagName = ''
    static attributeName = ''
    static attributeValue = ''
    static attributes = {}
    static status = 'A'
    static fullStream = ''
    static candinateTag = ''
    static typingDiv = null
    static container = null

    static updateStatus(x) {
        Parser.status = x;
    }

    static candinateTagIsContent(x) {
        Parser.blocks[Parser.blocks.length - 1].content += Parser.candinateTag + x;
        Parser.blocks[Parser.blocks.length - 1].container.append(Parser.candinateTag + x);
        Parser.candinateTag = "";
        Parser.updateStatus("A");
    }

    static addToCandinateTag(x) {
        Parser.candinateTag += x;
    }

    static addToTagName(x) {
        Parser.tagName += x;
    }

    static addToAttributeName(x) {
        Parser.attributeName += x;
    }

    static addToAttributeValue(x) {
        Parser.attributeValue += x;
    }

    static addAttribute() {
        Parser.attributes[Parser.attributeName] = Parser.attributeValue;

        Parser.attributeName = "";
        Parser.attributeValue = "";
    }

    static addBlock() {
        if (Parser.container) {
            Parser.container.end();
        }

        if (Parser.tagName.toLowerCase() == 'code') {
            Parser.container = new CodeViewer(Parser.attributes['filename'], Parser.attributes['language'])

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }
        else if (Parser.tagName.toLowerCase() == 'hotanswer') {
            Parser.container = new HotAnswer()

            document.getElementById('hotAnswers').appendChild(
                Parser.container.element
            );
        }
        else if (Parser.tagName.toLowerCase() == 'youtube') {
            Parser.container = new YoutubeViewer()

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }
        else if (Parser.tagName.toLowerCase() == 'audio') {
            Parser.container = new AudioPlayer()

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }
        else /*if (Parser.tagName.toLowerCase() == 'text')*/ {
            Parser.container = new TextViewer()

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }

        Parser.blocks.push({
            type: Parser.tagName.toLowerCase(),
            attributes: Parser.attributes,
            content: "",
            container: Parser.container
        });

        Parser.tagName = "";
        Parser.attributeName = "";
        Parser.attributeValue = "";
        Parser.attributes = {};
        Parser.candinateTag = "";

        Parser.updateStatus("A");
    }

    static parse(c) {
        Parser.fullStream += c

        // Status A
        if (Parser.status === "A") {
            if (c === "<") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("B");
            } else {
                Parser.candinateTagIsContent(c);
            }
        }

        // Status B
        else if (Parser.status === "B") {
            if (c === "*") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("C");
            } else {
                Parser.candinateTagIsContent(c);
            }
        }

        // Status C
        else if (Parser.status === "C") {
            if (c === "&") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("D");
            } else {
                Parser.candinateTagIsContent(c);
            }
        }

        // Status D
        else if (Parser.status === "D") {
            if (c === "&") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("G");
            }
            else if (c === ":") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("E");
            }
            else {
                Parser.addToCandinateTag(c);
                Parser.addToTagName(c);
                Parser.updateStatus("D");
            }
        }

        // Status E
        else if (Parser.status === "E") {
            if (c === "=") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("F");
            }
            else {
                Parser.addToCandinateTag(c);
                Parser.addToAttributeName(c);
                Parser.updateStatus("E");
            }
        }

        // Status F
        else if (Parser.status === "F") {
            if (c === "&") {
                Parser.addToCandinateTag(c);
                Parser.addAttribute();
                Parser.updateStatus("G");
            }
            else if (c === ":") {
                Parser.addToCandinateTag(c);
                Parser.addAttribute();
                Parser.updateStatus("E");
            }
            else {
                Parser.addToCandinateTag(c);
                Parser.addToAttributeValue(c);
                Parser.updateStatus("F");
            }
        }

        // Status G
        else if (Parser.status === "G") {
            if (c === "*") {
                Parser.addToCandinateTag(c);
                Parser.updateStatus("H");
            }
            else {
                Parser.candinateTagIsContent(c);
            }
        }

        // Status H
        else if (Parser.status === "H") {
            if (c === ">") {
                Parser.addBlock();
            }
            else {
                Parser.candinateTagIsContent(c);
            }
        }
    }
}

export default Parser;