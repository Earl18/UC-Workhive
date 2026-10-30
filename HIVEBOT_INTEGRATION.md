# HiveBot website integration

HiveBot uses the trained WorkHive classifier copied from the sibling `UC WorkHive AI` project. The approved model, checksum, and knowledge files are bundled in `hivebot-ai/`. The API keeps one Python worker alive per Next.js server process. It does not use a third-party AI API or read live HR records.

The server derives the caller's role from the signed WorkHive session. The browser cannot select a role. The Python bridge enforces these topic sets before returning an answer:

| Role | Allowed questions |
| --- | --- |
| Public | WorkHive overview, sign in, careers, applications, privacy |
| Employee | Public topics plus employee attendance, leave, profile, documents, notifications, and holidays |
| HR | Public topics plus HR employee management, attendance reports, leave management, recruitment, interviews, and reports |
| Admin | Public topics plus system settings, feature toggles, GPS zones, users and roles, email templates, and audit log |

Mixed questions containing a restricted operation are refused. The model also refuses personal or confidential data requests. These are general help answers, not live account information.

Common typing mistakes are repaired against WorkHive's approved question vocabulary before intent matching. Both the original and repaired text pass the privacy and role checks. The repair is conservative; unfamiliar or ambiguous wording may still receive an unknown answer.

For local development, the website automatically uses `../UC WorkHive AI/.venv/Scripts/python.exe` on Windows when it exists. Otherwise, set `HIVEBOT_PYTHON` to a Python executable with the packages in `requirements.txt`. The production Docker image installs those packages and copies `hivebot-ai/` into the runner.

Run the role regression tests with `python -m unittest -q test_bridge` from `hivebot-ai/`. If the source project's approved knowledge or training data changes, copy its matching model and checksum together; the bridge refuses mismatched files.
