from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import json
import getPython as gP
app = Flask(__name__)
# allow requests from multiple origins.
CORS(app)

@app.route("/")
def initial():
    return render_template("pdfViewer.html")

# get the get request/get text from the response. 
# create a get request for a webpage, and then generate the pdf.
@app.route("/getWebpage", methods=['POST'])
def getW():
    response = request.get_json()
    list = gP.getPrompt(response)
    jsonObj = {"link": list[0], "text": list[1]}
    jsonResult = jsonify(json.dumps(jsonObj))
    return jsonResult

@app.route("/sidebar")
def home():
    return render_template("sidebar.html")

if __name__ == "__main__":
    app.run(debug=True)
