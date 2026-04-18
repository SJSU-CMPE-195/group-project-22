from flask import Flask, jsonify, request, render_template, Response, stream_with_context, send_file
from flask_cors import CORS
import json
import chromadb
import getPython as gP
import io
import requests as req
from fpdf import FPDF
from bs4 import BeautifulSoup

app = Flask(__name__)
chromaClient = None
chromaCollection = None
# allow requests from multiple origins.
CORS(app)

@app.route("/")
def initial():
    global chromaClient
    global chromaCollection
    if chromaClient is None:
        chromaClient = chromadb.PersistentClient(path="./")
        chromaCollection = chromaClient.get_or_create_collection(name="collection")
    return render_template("app.html")

# get the get request/get text from the response. 
# create a get request for a webpage, and then generate the pdf.
@app.route("/getWebpage", methods=['POST'])
def getW():
    response = request.get_json()
    list = gP.getPrompt(response)
    jsonObj = {"link": list[0], "text": list[1]}
    jsonResult = jsonify(json.dumps(jsonObj))
    # add this webpages text for future requests.
    """chromaCollection.add (
        ids={json.dumps(response)},
        documents={json.dumps(jsonObj)},
    )"""
    jsonResult = jsonify(json.dumps(jsonObj))
    return jsonResult

@app.route("/stepIn", methods=["POST"]) 
# store the step in that the user did.
def stepIn():
   data = request.get_json()
   line = data.get("line")
   fileName = data.get("fileName")
   res = gP.getRelevantText(line, fileName)
   #obj = {"text": res[0], "pageNum": res[1]}
   #print(json.dumps(obj))
   return jsonify(json.dumps(res))
@app.route("/fetch-page", methods=['POST'])
def fetch_page():
    data = request.get_json()
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = req.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        for tag in soup(['script', 'style', 'nav', 'footer']):
            tag.decompose()
        text = soup.get_text(separator='\n').strip()

        font_path = "/Library/Fonts/Arial Unicode.ttf"
        pdf = FPDF()
        pdf.add_page()
        pdf.add_font('Arial', '', font_path)
        pdf.set_font('Arial', size=11)
        pdf.multi_cell(0, 7, text)

        pdf_bytes = pdf.output()
        return send_file(
            io.BytesIO(bytes(pdf_bytes)),
            mimetype='application/pdf',
            as_attachment=True,
            download_name='fetched-page.pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/chatMessage", methods=["POST"])
def chat_message():
    data = request.get_json()
    try:
        chat_history = data.get("chatHistory", [])

        def generate():
            stream = gP.getChatResponse(chat_history)
            for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content

        return Response(
            stream_with_context(generate()),
            content_type="text/plain; charset=utf-8"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
