import CodeViewer from './CodeViewer.js';
import TextViewer from './TextViewer.js';
import HotAnswer from './HotAnswer.js';
import YoutubeViewer from './YoutubeViewer.js';
import ImageViewer from './ImageViewer.js';
import AudioPlayer from './AudioPlayer.js';
import CommandViewer from './CommandViewer.js';

class Parser {
    static blocks = []

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

    static addBlock(renderAtEnd = false, lastMessage = false) {
        if (Parser.container) {
            Parser.container.end();
        }

        if (Parser.tagName.toLowerCase() == 'code') {
            Parser.container = new CodeViewer(Parser.attributes['filename'], renderAtEnd)

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }
        else if (Parser.tagName.toLowerCase() == 'hotanswer') {
            Parser.container = new HotAnswer(renderAtEnd, lastMessage)
            
            if ((!renderAtEnd || lastMessage && renderAtEnd)){
                document.getElementById('hotAnswers').appendChild(
                    Parser.container.element
                );
            }
        }
        else if (Parser.tagName.toLowerCase() == 'youtube') {
            Parser.container = new YoutubeViewer()

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }
        else if (Parser.tagName.toLowerCase() == 'image') {
            Parser.container = new ImageViewer()

            Parser.typingDiv.appendChild(
                Parser.container.element
            );
        }
        else if (Parser.tagName.toLowerCase() == 'command') {
            Parser.container = new CommandViewer(renderAtEnd)

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
            Parser.container = new TextViewer(renderAtEnd)

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

    static parse(chunck, renderAtEnd = false, lastMessage = false) {
        Parser.fullStream += chunck

        if (Parser.blocks.length == 0)
            Parser.addBlock(renderAtEnd, lastMessage)

        for(const c of chunck){
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
                    Parser.addBlock(renderAtEnd, lastMessage);
                }
                else {
                    Parser.candinateTagIsContent(c);
                }
            }
        }
    }

    static reset() {
        Parser.blocks = [];
        Parser.tagName = '';
        Parser.attributeName = '';
        Parser.attributeValue = '';
        Parser.attributes = {};
        Parser.status = 'A';
        Parser.fullStream = '';
        Parser.candinateTag = '';
        Parser.container = null;
        // typingDiv is not reset here — caller sets it
    }

    static parseFull(content, container, renderAtEnd = false, lastMessage = false) {
        Parser.reset();
        Parser.typingDiv = container;
        Parser.parse(content, renderAtEnd, lastMessage);
        // Finalize the last open block
        if (Parser.container) {
            Parser.container.end();
        }
        return container;
    }
}

export default Parser;
