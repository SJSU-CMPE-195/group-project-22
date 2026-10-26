# LearningDebugger

> AI Study tool that acts like a code debugger through documents 

## Team

| Name | GitHub | Email |
|------|--------|-------|
| Tanay Allaparti | [@tanay2405](https://github.com/tanay2405) | tanay.allaparti@sjsu.edu |
| Aaron Chen | [@Aaron2882](https://github.com/Aaron2882) | aaron.chen@sjsu.edu |
| Alvin Le | [@ALe-BD](https://github.com/ALe-BD) | alvin.le@sjsu.edu |
| Saivardan Mamidi | [@saimamidi01](https://github.com/saimamidi01) | saivardan.mamidi@sjsu.edu |

**Advisor:** [KaiKai Liu]

---
## Project Description

This web application is an AI assistant that allows the user to cluster study material like a textbook or notes. It allows the user to view those documents going line by line and stepping in and out to different materials to the relevant sections within those materials like a debugger. If you do not have enough sources, the app will provide the user with relevant websites. The AI chat at the side can provide clear summaries and about the page they are currently on.

---
## Prototype Scope

The LearningDebugger prototype covers the main end-to-end user workflow from adding and deleting files, fetching contextually relevant urls into pdfs for download or adding to the file list, navigating through line by line, stepping into and out of text and finding relevant contextual information on another to navigate towards, and asking chat for page context and questions while history is saved and data is stored with use.

---
## System Architecture
![Screenshot](docs/SystemArchitecture.png)

---
## Prerequisites

- [Flask] v.3.1.3+
- [flask_cors] v.6.0.2+
- [ollama] v.0.6.1+
- [requests] v.2.32.5+
- [fpdf2] v.2.8.4+
- [beautifulsoup4] v.4.14.3+
- [chromadb] v.1.5.8+
- [pypdf] v.6.10.2+
- [playwright] v.1.64.1+
- [pillow] v.11.3.0+

---
## Installation

```bash
1. Install Ollama App
2. Get the cloud model for step ins: ollama run gemma4:31b-cloud

# Clone the repository
3. git clone https://github.com/SJSU-CMPE-195/group-project-group9.git
4. cd group-project-group9

# Install dependencies
5. pip install -r requirements.txt
6. python -m playwright install 
```

---
## Running the Prototype

```bash
# Development mode
python ./src/app.py 

# The app will be available at http://localhost:5000
```

---
## Testing
Covers the fetch-url pdf as of now.
pytest tests/ -v

---
## Demo
 [Workflow Demo](https://drive.google.com/file/d/1QIfCBFvfz6tIShQ7OncN1vXOdNzZSK51/view?usp=sharing)

---
## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python (Flask), Ollama (local LLM) |
| Database | ChromaDB |
| Deployment | N/A |

---
## What's Next

Clean up the step in code and finish adding uploaded files to chromadb. Finish the webpage step in, so that it downloads the pdf and highlights the relevant text it gets. Add more tests for the project and deployment.

---
## Acknowledgments

- Project Advisor KaiKai Liu for guidance and feedback during development
- Flask, Flask-CORS, Ollama for open-source tools building project architecture and core functionality
- All team members for collaboration and contributions

---
*CMPE 195A/B - Senior Design Project | San Jose State University | Spring 2026*

