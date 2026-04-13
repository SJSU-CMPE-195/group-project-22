from ollama import chat
from ollama import ChatResponse

def getPrompt(line):
   print("Sending Prompt")
# specify the string from the file.
   # Sends the chat reponse (from the Ollama github) 
   response: ChatResponse = chat(model='minimax-m2.7:cloud', messages=[
      {
         'role': 'user',
         'content': 'From the training data, can you give a website with more info and relevant text from it, (PLEASE FOLLOW FORMAT) please structure the prompt with sections link: and text:' + 
                    'The user is confused about ' + line
      },

   ])

   # response.message.content has the response from the model.
   promptResponse = response.message.content
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
   #Checks for errors.
   if(linkInd == -1):
      print("link was not found: ")
      return results
   if(textInd == -1):
      print("text was not found")
      return results
   results.append(linkStr)
   results.append(textStr)
   return results


   
