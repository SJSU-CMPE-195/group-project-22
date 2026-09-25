from flask import (
    Flask,
    jsonify,
    request,
    render_template,
    Response,
    stream_with_context,
    send_file,
    send_from_directory,
)
from flask_cors import CORS
import chromadb
import uuid
import requests

# import json
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


@app.route("/files/<path:filename>")
def serve_file(filename):
    return send_from_directory("files", filename)


@app.route("/")
def initial():
    global chromaClient
    global chromaCollection
    global page_collection
    if chromaClient is None:
        chromaClient = chromadb.PersistentClient(path="./")
        chromaCollection = chromaClient.get_or_create_collection(name="collection")
        page_collection = chromaClient.get_or_create_collection(name="page_collection")
    return render_template("app.html")


# get the get request/get text from the response.
# create a get request for a webpage, and then generate the pdf.
@app.route("/getWebpage", methods=["POST"])
def getW():
    response = request.get_json()
    list = gP.getPrompt(response)
    # jsonObj = {"link": list[0], "text": list[1]}
    # add this webpages text for future requests.
    """chromaCollection.add (
        ids={json.dumps(response)},
        documents={json.dumps(jsonObj)},
    )"""
    jsonResult = jsonify({"link": list[0], "text": list[1]})
    return jsonResult


@app.route("/stepIn", methods=["POST"])
# store the step in that the user did.
def stepIn():
    data = request.get_json()
    line = data.get("line")
    fileName = data.get("fileName")
    res = gP.getRelevantText(line, fileName)
    # obj = {"text": res[0], "pageNum": res[1]}
    # print(json.dumps(obj))
    return jsonify({"text": res[0], "pageNum": res[1]})


@app.route("/fetch-page", methods=["POST"])
def fetch_page():
    data = request.get_json()
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = req.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        text = soup.get_text(separator="\n").strip()

        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=11)
        text = text.encode("latin-1", "ignore").decode("latin-1")
        pdf.multi_cell(0, 7, text)

        raw = pdf.output(dest="S")
        pdf_bytes = (
            bytes(raw) if isinstance(raw, (bytearray, bytes)) else raw.encode("latin-1")
        )
        return send_file(
            io.BytesIO(bytes(pdf_bytes)),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="fetched-page.pdf",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/chatMessage", methods=["POST"])
def chat_message():
    data = request.get_json()
    try:
        chat_history = data.get("chatHistory", [])
        model = data.get("model")

        # Get latest user message
        user_message = ""
        if chat_history:
            user_message = chat_history[-1].get("content", "")

        # Query Chroma for relevant page context
        page_context = ""
        
        if page_collection.count() > 0:
            results = page_collection.query(
            query_texts=[user_message],
            n_results=min(4, page_collection.count()),
            include=["documents", "distances"]
        )
        documents = results.get("documents", [[]])[0]  # Get the first list of documents
        distances = results.get("distances", [[]])[0]  # Get the first list of distances

        relvant_documents = [
            doc for doc, dist in zip(documents, distances) if dist < 1
        ]

        page_context = "\n\n".join(relevant_documents)

        # Make a copy so we don't modify the original chat history
        messages_for_model = chat_history.copy()

        if page_context:
            context_message = {
                "role": "system",
                "content": (
                    "The following information was retrieved from pages "
                    "the user previously added as context:\n\n"
                    + page_context
                )
            }

            # Put context after your original system message
            if messages_for_model and messages_for_model[0].get("role") == "system":
                messages_for_model.insert(1, context_message)
            else:
                messages_for_model.insert(0, context_message)

        def generate():
            stream = gP.getChatResponse(messages_for_model, model)

            for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content

        return Response(
            stream_with_context(generate()), content_type="text/plain; charset=utf-8"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/add-page-to-chroma", methods=["POST"])
def add_page_to_chroma():
    data = request.get_json()

    page_text = data.get("text", "")

    if not page_text.strip():
        return jsonify({"error": "No page text supplied"}), 400

    chunks = gP.chunk_text(page_text)

    ids = []
    documents = []
    metadatas = []

    for index, chunk in enumerate(chunks):
        ids.append(str(uuid.uuid4()))
        documents.append(chunk)

        metadatas.append({
            "source": "current_page",
            "chunk": index
        })

    page_collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )

    return jsonify({
        "success": True,
        "chunks": len(chunks)
    })

@app.route("/api/models")
def get_models():
    models = gP.getOllamaModels()

    return jsonify({
        "models": models
    })

# tests to see what is in chroma collection page collection
@app.route("/debug/chroma", methods=["GET"])
def debug_chroma():
    results = page_collection.get(
        include=["documents", "metadatas"]
    )

    data = []

    for i, doc_id in enumerate(results["ids"]):
        data.append({
            "id": doc_id,
            "document": results["documents"][i],
            "metadata": results["metadatas"][i]
        })

    return jsonify({
        "count": len(data),
        "items": data
    })

@app.route("/clear-page-collection", methods=["POST"])
def clear_page_collection():
    try:
        results = page_collection.get()

        if results["ids"]:
            page_collection.delete(ids=results["ids"])

        return jsonify({
            "success": True,
            "message": "Page collection cleared"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
if __name__ == "__main__":
    gP.ensure_ollama_running()
    app.run(debug=True)
