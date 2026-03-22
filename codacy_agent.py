import os
import google.generativeai as genai

# This will pull the exact same key your UI designer is already using
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def fix_codacy_issue(file_path, issue_description):
    with open(file_path, "r") as f:
        original_code = f.read()

    # Defining the agent's exact role
    sys_prompt = "You are an agent to fix the UI/SEO and other Problems to solve. Return ONLY the raw, corrected code. Do not include markdown formatting blocks. Do not include any conversational text."
    
    user_prompt = f"Issue: {issue_description}\n\nFile Content:\n{original_code}"
    
    # Using flash to keep it fast and lightweight
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=sys_prompt
    )
    
    response = model.generate_content(user_prompt)
    
    # Safely overwrite the file with the AI's fix
    with open(file_path, "w") as f:
        f.write(response.text.strip())
        
    print(f"Applied fix to {file_path}")

# We will comment this out for now until we set up the GitHub Action
# fix_codacy_issue("templates/index.html", "Missing alt attribute on img tag")
