"""Turn the Google Form's structure into src/questionnaire.json.

The form page carries its whole structure in a variable, FB_PUBLIC_LOAD_DATA_. Save that array as
JSON, then run:

    python3 -I scripts/form_to_questionnaire.py <form.json> src/questionnaire.json

Every piece of text comes from the form as it is: nothing is retyped. The only edits are two
sentences that point at the Google Form's own Submit button, which this app doesn't have (noted
below where they are dropped). Each item is checked against its expected title, so a change in the
form stops the script instead of shifting items silently.
"""

import json
import re
import sys

SHORT, PARAGRAPH, CHOICE, CHECKBOX, TEXT, GRID, SECTION = 0, 1, 2, 4, 6, 7, 8


def main(src: str, dst: str) -> None:
    data = json.load(open(src, encoding="utf-8"))
    form = data[1]
    items = form[1]

    def item(i: int, title_start: str, kind: int):
        it = items[i]
        if not (it[1] or "").startswith(title_start) or it[3] != kind:
            raise SystemExit(f"item {i} is {it[1]!r} (type {it[3]}), expected {title_start!r} (type {kind})")
        return it

    def desc(it) -> str:
        return (it[2] or "").strip()

    def options(it) -> list[str]:
        return [o[0] for o in it[4][0][1] if o[0]]

    def has_other(it) -> bool:
        return any(len(o) > 4 and o[4] for o in it[4][0][1])

    def drop(text: str, sentence: str) -> str:
        if sentence not in text:
            raise SystemExit(f"expected {sentence!r} in {text!r}")
        return text.replace(sentence, "").strip()

    # --- the start, the age check -------------------------------------------------------------
    # the form starts with a respondent code; the app asks for none (the researchers dropped the
    # codes on 2026-11-18), but the item is still checked, so the indexes below stay right
    item(0, "Respondent code", SHORT)
    age = item(1, "Are you 18 years old or older?", CHOICE)
    minor = item(2, "Parent or guardian consent needed", SECTION)

    # --- the consent form ---------------------------------------------------------------------
    consent_head = item(3, "Informed Consent", SECTION)
    section_titles = [
        "Purpose of the Research",
        "Selection of Participants",
        "Procedure",
        "Duration",
        "Risks",
        "Benefits",
        "Voluntary Participation",
        "Confidentiality and Data Management",
        "Sharing the Results",
        "Statement of Consent",
    ]
    sections = []
    for offset, title in enumerate(section_titles):
        it = item(4 + offset, title, TEXT)
        sections.append({"title": it[1], "body": desc(it)})
    data_use = item(14, "Please tick the appropriate box:", CHECKBOX)
    name = item(15, "Participant", SHORT)
    signature = item(16, "Signature", SHORT)
    address = item(17, "Address", SHORT)
    agree = item(18, "Do you agree to take part in this study?", CHOICE)

    # --- the letter and the general directions ------------------------------------------------
    letter = item(19, "Dear Respondent,", SECTION)
    directions = item(20, "General Directions", TEXT)

    # --- Part I --------------------------------------------------------------------------------
    part1 = item(21, "Part I.", SECTION)
    p1_age = item(22, "Age", SHORT)
    p1_sex = item(23, "Sex", CHOICE)
    p1_year = item(24, "Year level", CHOICE)
    p1_l1 = item(25, "First language", CHOICE)
    p1_home = item(26, "Language you use most often at home", CHOICE)
    p1_engfreq = item(27, "How often do you speak English outside your classes?", CHOICE)
    for it in (p1_l1, p1_home):
        if not has_other(it):
            raise SystemExit(f"{it[1]!r} has no Other option")
    # the year level picks the group: first year, second year, and the pilot's third year
    years = options(p1_year)
    if len(years) != 3 or "pilot" not in years[2].lower():
        raise SystemExit(f"expected three year levels, the third for the pilot: {years!r}")

    part_one = {
        "id": "P1",
        "title": part1[1],
        "directions": desc(part1),
        "items": [
            {"n": 1, "id": "P1_age", "label": p1_age[1], "type": "number"},
            {"n": 2, "id": "P1_sex", "label": p1_sex[1], "type": "choice", "options": options(p1_sex)},
            {"n": 3, "id": "P1_year", "label": p1_year[1], "type": "choice", "options": years},
            {"n": 4, "id": "P1_l1", "label": p1_l1[1], "type": "choice", "options": options(p1_l1), "other": "P1_l1_other"},
            {"n": 5, "id": "P1_home", "label": p1_home[1], "type": "choice", "options": options(p1_home), "other": "P1_home_other"},
            {"n": 6, "id": "P1_engfreq", "label": p1_engfreq[1], "type": "choice", "options": options(p1_engfreq)},
        ],
    }

    # --- Parts II to V: one grid each, rows "1. statement", columns "5 Always" ... "1 Never" -------
    def likert_part(section_index: int, grid_index: int, part_id: str, title_start: str, stem_start: str):
        head = item(section_index, title_start, SECTION)
        grid = item(grid_index, stem_start, GRID)
        text = desc(head)
        # the directions end with the scale written out ("5 = Always     4 = Often ..."); the app
        # draws the scale itself, from the grid's own columns
        directions, legend = text.rsplit("\n\n", 1)
        if not legend.startswith("5 = "):
            raise SystemExit(f"{part_id}: expected the scale after the directions, got {legend!r}")
        columns = None
        rows = []
        for e in grid[4]:
            cols = [o[0] for o in e[1]]
            if columns is None:
                columns = cols
            elif cols != columns:
                raise SystemExit(f"{part_id}: rows with different columns")
            m = re.match(r"^(\d+)\.\s+(.*)$", e[3][0], re.S)
            if not m or int(m.group(1)) != len(rows) + 1:
                raise SystemExit(f"{part_id}: row {e[3][0]!r} is out of order")
            rows.append({"n": int(m.group(1)), "id": f"{part_id}_{int(m.group(1)):02d}", "text": m.group(2)})
        scale = []
        for c in columns:
            m = re.match(r"^([1-5]) (.+)$", c)
            if not m:
                raise SystemExit(f"{part_id}: column {c!r}")
            scale.append({"value": int(m.group(1)), "label": m.group(2)})
        if [s["value"] for s in scale] != [5, 4, 3, 2, 1]:
            raise SystemExit(f"{part_id}: the scale must run 5 to 1")
        return {
            "id": part_id,
            "title": head[1],
            "directions": directions.strip(),
            "stem": grid[1],
            "scale": scale,
            "items": rows,
        }

    parts = [
        part_one,
        likert_part(28, 29, "P2", "Part II.", "How often does each statement happen to you?"),
        likert_part(30, 31, "P3", "Part III.", "When I cannot remember an English word while I am speaking"),
        likert_part(32, 33, "P4", "Part IV.", "I have trouble remembering English words when"),
        likert_part(34, 35, "P5", "Part V.", "How much do you agree with each statement?"),
    ]
    counts = [len(p["items"]) for p in parts]
    if counts != [6, 8, 21, 10, 10]:
        raise SystemExit(f"item counts {counts}, expected 6, 8, 21, 10, 10")

    # --- pilot only, the closing message --------------------------------------------------------
    pilot = item(36, "For Pilot Test Respondents Only", SECTION)
    pilot_q = item(37, "Were any statements or directions unclear", PARAGRAPH)
    closing = form[2][0]

    out = {
        "source": "Google Form 1FAIpQLSdMZwBxCj5m1gh2XSvsJvRJ3c3z0OXHrUkZmR_l6-AygU7L9A",
        "title": form[8],
        "description": (form[0] or "").strip(),
        "age_check": {
            "question": age[1],
            "options": options(age),
            "stop_title": minor[1],
            # dropped: "Click Submit to end for now." (the form's own Submit button)
            "stop_message": drop(desc(minor), "Click Submit to end for now."),
        },
        "consent": {
            "title": consent_head[1],
            "intro": desc(consent_head),
            "sections": sections,
            "data_use": {"prompt": data_use[1], "options": options(data_use)},
            "fields": {"name": name[1], "signature": signature[1], "address": address[1]},
            "agree": {"question": agree[1], "yes": options(agree)[0], "no": options(agree)[1]},
        },
        "letter": {"greeting": letter[1], "body": desc(letter)},
        "general_directions": {"title": directions[1], "body": desc(directions)},
        "parts": parts,
        "pilot_only": {
            "title": pilot[1],
            # dropped: "Everyone else may click Submit." (only pilot respondents see this page here)
            "intro": drop(desc(pilot), "Everyone else may click Submit."),
            "question": pilot_q[1],
        },
        "closing_message": closing,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    total = sum(counts)
    likert = sum(counts[1:])
    print(f"wrote {dst}: {total} items ({counts[0]} profile, {likert} Likert)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
