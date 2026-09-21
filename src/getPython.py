from ollama import chat
from ollama import ChatResponse
from pypdf import PdfReader
import difflib

# this is for webpage for information
def getPrompt(line):
    print("Sending Prompt")
    # specify the string from the file.
    # Sends the chat reponse (from the Ollama github)
    response: ChatResponse = chat(
        model="qwen3:1.7b",
        messages=[
            {
                "role": "user",
                "content": "From the training data, can you give a website with more info and relevant text from it, "
                "(PLEASE FOLLOW FORMAT EXACTLY) please structure the response with sections link: and text: "
                + "The user is confused about "
                + line,
            },
        ],
    )

    # response.message.content has the response from the model.
    promptResponse = response.message.content
    print(promptResponse)
    # store the length of the starting strings
    linkLen = len("link: ")
    textLen = len("text: ")
    # Used to detect error.

    linkInd = promptResponse.find("link: ")
    textInd = promptResponse.find("text: ")
    # this stores the index after the space, so it is where the data start. For example,
    # "link: " starts at 0 0+6 = 6, this is the index after the space where the url is.
    linkEnd = linkInd + linkLen
    textEnd = textInd + textLen

    # this gets the substrings, the link goes from the linkEnd to that the start  of text excluding.
    linkStr = promptResponse[linkEnd:textInd]
    textStr = promptResponse[textEnd:]
    results = []
    # Checks for errors.
    if linkInd == -1 and textInd != -1:
        results.append("No link")
        results.append(textStr)
        return results
    if textInd == -1:
        results.append("No text")
        results.append("No link")
        return results
    results.append(linkStr)
    results.append(textStr)
    return results


def getChatResponse(chatHistory):

    return chat(
        model="tinyllama:latest",
        messages=chatHistory,
        options={"temperature": 0.7},
        stream=True,
    )


def getRelevantText(line, fileName):
    print("Sending step In prompt")
    document = PdfReader("./files/default/" + fileName)
    length = len(document.pages)
    if len(document.pages) > 20:
        length = 20
    text = ""
    for i in range(length):
        page_text = document.pages[i].extract_text()
        if page_text:
            text += page_text + "\n"
    # textarr = text.split("\n")
    if not text.strip():
        print("Debug: No extractable text in pdf");
        return "No extractable text in Pdf.", None, []
    
    response: ChatResponse = chat(
        model="gemma4:31b-cloud",
        messages=[
            {
                "role": "user",
                "content": "From the following text: (MUST ANSWER WITH A SECTION FROM THIS TEXT ONLY, NO PARAPHRASING) "
                + text
                + "Give me ONLY the most relevant text (ANSWER WITH JUST THIS TEXT VERBATIM) related to the following."
                + str(line),
            },
        ],
    )
    promptRes = response.message.content
    
    print(promptRes)
    snippet_lines = [
        l.strip()
        for l in promptRes.split("\n")
        if l.strip()
    ]
    for sl in snippet_lines:
        print(f"SNIPPET: [{sl}]")

    for i in range(len(document.pages)):
        page_text = document.pages[i].extract_text()
        if not page_text:
            continue
        page_lines = [
            l.strip()
            for l in page_text.split("\n")
            if l.strip()
        ]
        print(f"\n--- PAGE {i} ---")
        for pl in page_lines:
            print(f"PAGE LINE: [{pl}]")
        for snippet_line in snippet_lines:
            print(f"COMPARE snippet=[{snippet_line}] WITH PAGE LINE(S)")
            if snippet_line in page_lines:
                print(f"\n*** MATCH FOUND ***")
                print(f"Matched snippet line: [{snippet_line}]")
                print(f"On page: {i}")
                return promptRes, i, page_lines
    print("\n*** NO PAGE MATCH FOUND ***")
    return promptRes, None, []
