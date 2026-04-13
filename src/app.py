from flask import Flask, render_template

app = Flask(__name__)

@app.route("/sidebar")
def home():
    return render_template("sidebar.html")

@app.route("/pdfViewer")
def pdfViewer():
    return render_template("pdfViewer.html")

if __name__ == "__main__":
    app.run(debug=True)