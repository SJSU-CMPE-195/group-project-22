from ollama import chat
from ollama import ChatResponse
from pypdf import PdfReader
import subprocess
import time
import httpx

OLLAMA_URL = "http://127.0.0.1:11434"

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

#chat side bar functionality
def getChatResponse(chatHistory, model):

    return chat(
        model=model,
        messages=chatHistory,
        options={"temperature": 0.7},
        stream=True,
    )

def getOllamaModels():

    try:
        response = httpx.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=5
        )

        response.raise_for_status()

        data = response.json()

        return [
            model["name"]
            for model in data.get("models", [])
        ]

    except httpx.HTTPError as e:
        print(f"Could not get Ollama models: {e}")
        return []

def ensure_ollama_running():
    try:
        httpx.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return
    except httpx.RequestError:
        print("Ollama is not running. Starting it...")

    subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )

    # Give Ollama a few seconds to start
    for _ in range(10):
        try:
            response = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=2)
            if response.status_code == 200:
                print("Ollama started successfully.")
                return
        except httpx.RequestError:
            pass

        time.sleep(1)

    raise RuntimeError("Ollama could not be started.")

def getRelevantText(line, fileName):
    print("Sending step In prompt")
    document = PdfReader("./files/default/" + fileName)
    length = len(document.pages)
    if len(document.pages) > 20:
        length = 20
    text = ""
    for i in range(length):
        text += document.pages[i].extract_text()
    #textarr = text.split("\n")
    promptString = "From the following text: (MUST ANSWER WITH A SECTION FROM THIS TEXT ONLY) " + text + "Give me ONLY the most relevant text (ANSWER WITH JUST THIS TEXT) related to the following." + line
    response: ChatResponse = chat(
        model="gemma4:31b-cloud",
        messages=[
            {
                'role': 'user',
                'content': promptString
            },
        ],
    )
    promptRes = response.message.content
    print(promptRes)

    """for i in range(len(document.pages)):
      if(document.pages[i].extract_text().strip().find(promptRes.strip()) != -1):
          pageNum = i"""
    return promptRes
