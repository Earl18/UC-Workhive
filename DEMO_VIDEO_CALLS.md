# Remote video call demo

This temporary mode keeps WorkHive on your computer and uses the public Jitsi Meet service for interview calls. It does not require deploying UC HiveConnect. Use sample interview records for the presentation.

1. In WorkHive's `.env`, set `HIVECONNECT_DEMO_MODE=true` and restart the WorkHive server. Keep it `false` to use your local UC HiveConnect server.
2. In VS Code's **Ports** panel, forward WorkHive's port **3000** and change its visibility to **Public** if your professor needs to open the WorkHive site. Keep VS Code and the WorkHive server running. The HiveConnect 8443 port does not need forwarding for this demo.
3. Create a new **Online** interview for a sample applicant. The generated guest link should begin with `https://meet.jit.si/`.
4. In **Video Conferencing**, select **Open room**. The interviewer must sign in to Jitsi with a supported account before guests can join. If the sign-in does not complete inside WorkHive, use **Open meeting in a new tab**.
5. Select **Copy guest link** and send it to a colleague. They can open that link at home without a WorkHive account. If asked, admit them from the meeting lobby.

Previously scheduled records can still show their old `localhost` link in the schedule details. **Copy guest link** on the Video Conferencing page produces a usable public link for those rooms. For a clean presentation or emailed invite, make a new sample schedule.

After the presentation, set `HIVECONNECT_DEMO_MODE=false` and restart WorkHive to return to the self-hosted HiveConnect configuration. Existing public Jitsi links remain public Jitsi links; make new schedules when changing back.
