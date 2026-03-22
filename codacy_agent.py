import os
import sys
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Grab the comment text passed from the GitHub Action
github_comment = sys.argv[1] 

def fix_codacy_issue(file_path, user_instruction):
    try:
        with open(file_path, "r") as f:
            original_code = f.read()
    except FileNotFoundError:
        print(f"Could not find {file_path}. Make sure the path is correct.")
        return

    sys_prompt = "You are an agent to fix the UI/SEO and other Problems to solve. Return ONLY the raw, corrected code. Do not include markdown formatting blocks. Do not include any conversational text."
    
    user_prompt = f"Instruction: {user_instruction}\n\nFile Content:\n{original_code}"
    
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=sys_prompt
    )
    
    response = model.generate_content(user_prompt)
    
    with open(file_path, "w") as f:
        f.write(response.text.strip())
        
    print(f"Applied fix to {file_path}")

# A simple way to extract the file path from your comment
# Assuming your comment looks like: "@ai-agent templates/index.html fix the tags"
words = github_comment.split()
file_to_edit = None

# Look for the word that has a file extension
for word in words:
    if "." in word and "/" in word: # e.g., templates/index.html or app.py
        file_to_edit = word
        break
    elif word.endswith(".py") or word.endswith(".html") or word.endswith(".css"):
        file_to_edit = word
        break

if file_to_edit:
    fix_codacy_issue(file_to_edit, github_comment)
else:
    print("No file path detected in the comment. Please include the file name.")
