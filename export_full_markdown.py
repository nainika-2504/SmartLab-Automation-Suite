import docx

def docx_to_full_markdown(docx_path, md_path):
    doc = docx.Document(docx_path)
    with open(md_path, 'w', encoding='utf-8') as out:
        # Loop through body elements in order
        for child in doc._element.body:
            tag = child.tag.split('}')[-1]
            if tag == 'p':
                p = docx.text.paragraph.Paragraph(child, doc)
                txt = p.text.strip()
                if not txt:
                    continue
                if txt.startswith("SMARTLAB AUTOMATION SUITE: END-TO-END"):
                    out.write(f"# {txt}\n\n")
                elif txt in ["DECLARATION BY THE CANDIDATE", "BONAFIDE CERTIFICATE", 
                             "CERTIFICATE BY THE TRAINING OFFICER", "ACKNOWLEDGEMENT", 
                             "TABLE OF CONTENTS", "LIST OF TABLES", "LIST OF FIGURES", 
                             "LIST OF SYMBOLS, ABBREVIATIONS AND NOMENCLATURE",
                             "CHAPTER 1", "SYNOPSIS", "CHAPTER 2", "ABOUT THE ORGANIZATION",
                             "CHAPTER 3", "STUDENT SKILLSET PRIOR TO INTERNSHIP",
                             "CHAPTER 4", "TECHNICAL KNOWLEDGE ACQUIRED DURING IN-PLANT TRAINING",
                             "CHAPTER 5", "APPLICATION OF KNOWLEDGE & IMPLEMENTATION OF SMARTLAB AUTOMATION SUITE",
                             "CHAPTER 6", "COMPETENCY EVALUATION, SELF-ASSESSMENT & CONCLUSION",
                             "APPENDICES", "REFERENCES"]:
                    out.write(f"\n# {txt}\n\n")
                elif any(txt.startswith(f"{i}.") for i in range(1, 10)) and not txt.startswith("1. ") and not txt.startswith("2. "):
                    out.write(f"\n## {txt}\n\n")
                elif any(txt.startswith(f"5.{i}.") for i in range(1, 10)) or any(txt.startswith(f"6.{i}.") for i in range(1, 10)):
                    out.write(f"\n### {txt}\n\n")
                elif txt.startswith("Appendix "):
                    out.write(f"\n## {txt}\n\n")
                elif txt.startswith("Figure "):
                    out.write(f"\n> **{txt}**\n\n")
                elif txt.startswith("TABLE "):
                    out.write(f"\n### {txt}\n\n")
                elif txt.startswith("```"):
                    out.write(f"{txt}\n\n")
                else:
                    out.write(f"{txt}\n\n")
            elif tag == 'tbl':
                t = docx.table.Table(child, doc)
                if len(t.rows) == 0:
                    continue
                # Render markdown table
                headers = [cell.text.strip().replace('\n', ' ') for cell in t.rows[0].cells]
                out.write("| " + " | ".join(headers) + " |\n")
                out.write("| " + " | ".join(["---"] * len(headers)) + " |\n")
                for row in t.rows[1:]:
                    vals = [cell.text.strip().replace('\n', '<br>') for cell in row.cells]
                    out.write("| " + " | ".join(vals) + " |\n")
                out.write("\n")

    print(f"Successfully exported full markdown with tables to {md_path}")

if __name__ == '__main__':
    docx_to_full_markdown('Internship_Report_SmartLab_Automation_Suite.docx', 'INTERNSHIP_REPORT_COMPLETE.md')
