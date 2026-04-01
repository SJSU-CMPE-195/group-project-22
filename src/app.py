import os
print("APP.PY LOCATION:", os.path.abspath(__file__))

from flask import Flask, render_template
app = Flask(__name__)

@app.route('/')
def home():
    return "Hello, World!"

@app.route('/pdf')
def pdf_viewer():
    return render_template('pdfViewer.html')
    

if __name__ == '__main__':
    app.run(debug=True)