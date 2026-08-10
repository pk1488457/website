import { api, getMe, qs } from "../core/api.js";
import { escapeHtml, money, toast } from "../core/ui.js";
import { renderLayout } from "../components/layout.js";

await renderLayout();

const root = document.getElementById("jobDetails");
const id = qs("id");

if (!id) {
  root.innerHTML = '<div class="loading-box">Missing job ID.</div>';
} else {
  try {
    const r = await api.get(`/jobs/${id}`);
    const j = r.data;
    let currentUser = null;
    let userApplications = [];
    let isSaved = false;

    try {
      const meRes = await getMe();
      currentUser = meRes.data || meRes.user;

      if (currentUser && currentUser.role === 'user') {
        const [appsRes, savedRes] = await Promise.all([
          api.get("/applications/me?limit=100").catch(() => ({ data: [] })),
          api.get("/saved-jobs?limit=100").catch(() => ({ data: [] }))
        ]);
        userApplications = appsRes.data || [];
        const savedJobs = savedRes.data || [];
        isSaved = savedJobs.some(s => (s.job?._id || s.job) === id);
      }
    } catch {}

    const hasApplied = userApplications.some(app => (app.job?._id || app.job) === id);

    root.innerHTML = `
      <section class="job-detail">
        <div class="job-detail-grid">
          <article class="detail-main">
            <div class="detail-hero">
              <div class="company-logo">${escapeHtml((j.company?.name || "C").slice(0, 1).toUpperCase())}</div>
              <div>
                <h1>${escapeHtml(j.title)}</h1>
                <div class="muted-text">${escapeHtml(j.company?.name || "Company")} · ${escapeHtml(j.isRemote ? "Remote" : j.location?.city || "Location")}</div>
              </div>
            </div>

            <div class="detail-block">
              <h3>About the role</h3>
              <p style="white-space: pre-line;">${escapeHtml(j.description || "No description provided.")}</p>
            </div>

            ${j.responsibilities && j.responsibilities.length ? `
              <div class="detail-block">
                <h3>Responsibilities</h3>
                <ul>${j.responsibilities.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
              </div>
            ` : ""}

            ${j.requirements && j.requirements.length ? `
              <div class="detail-block">
                <h3>Requirements</h3>
                <ul>${j.requirements.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
              </div>
            ` : ""}

            ${j.skills && j.skills.length ? `
              <div class="detail-block">
                <h3>Skills Required</h3>
                <div class="detail-tags">${j.skills.map(x => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>
              </div>
            ` : ""}

            ${j.benefits && j.benefits.length ? `
              <div class="detail-block">
                <h3>Benefits</h3>
                <ul>${j.benefits.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
              </div>
            ` : ""}
          </article>

          <aside class="detail-side">
            <button id="applyBtn" class="btn ${hasApplied ? 'btn-secondary' : 'btn-primary'} full" ${hasApplied ? 'disabled' : ''}>
              ${hasApplied ? '<i class="fa-solid fa-check"></i> Applied' : 'Apply now'}
            </button>
            <button id="saveBtn" class="btn-ghost full">
              <i class="fa-${isSaved ? 'solid' : 'regular'} fa-bookmark"></i> ${isSaved ? 'Saved' : 'Save job'}
            </button>
            <div class="detail-block" style="margin-top:20px;">
              <b>Salary</b>
              <p>${money(j.salaryMin, j.salaryMax, j.salaryCurrency, j.isSalaryDisclosed)}</p>
              <b>Experience</b>
              <p>${j.experienceMin || 0}${j.experienceMax ? `–${j.experienceMax}` : "+"} years</p>
              <b>Job Type</b>
              <p>${escapeHtml(j.jobType || "Full time")}</p>
              <b>Location</b>
              <p>${escapeHtml(j.isRemote ? "Remote" : `${j.location?.city || ""} ${j.location?.state || ""}`.trim() || "Not specified")}</p>
            </div>
          </aside>
        </div>
      </section>

      <!-- Apply Modal -->
      <div id="applyModal" class="modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:10000; display:none; align-items:center; justify-content:center; padding:20px;">
        <div style="background:#fff; border-radius:16px; width:100%; max-width:520px; padding:28px; box-shadow:0 20px 40px rgba(0,0,0,0.2); position:relative;">
          <button id="closeModal" style="position:absolute; top:18px; right:18px; border:none; background:none; font-size:20px; cursor:pointer; color:#64748b;">&times;</button>
          <h2 style="margin-top:0; margin-bottom:6px; font-size:20px;">Apply for ${escapeHtml(j.title)}</h2>
          <p style="color:#64748b; font-size:14px; margin-bottom:20px;">${escapeHtml(j.company?.name || "Company")}</p>
          
          <form id="applyForm" style="display:grid; gap:16px;">
            <label style="display:block; font-size:14px; font-weight:500;">
              Upload Resume PDF/DOC <span style="color:#ef4444">*</span>
              <input type="file" name="resume" accept=".pdf,.doc,.docx" required class="input" style="margin-top:6px; width:100%;">
            </label>
            <label style="display:block; font-size:14px; font-weight:500;">
              Cover Letter <span style="color:#64748b; font-size:12px;">(optional)</span>
              <textarea name="coverLetter" rows="4" placeholder="Introduce yourself and explain why you're a great fit..." class="input" style="margin-top:6px; width:100%; resize:vertical;"></textarea>
            </label>
            <div style="display:flex; justify-content:end; gap:10px; margin-top:10px;">
              <button type="button" id="cancelApply" class="btn-ghost">Cancel</button>
              <button type="submit" id="submitApply" class="btn btn-primary">Submit Application</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const applyBtn = document.getElementById("applyBtn");
    const saveBtn = document.getElementById("saveBtn");
    const modal = document.getElementById("applyModal");
    const closeModal = document.getElementById("closeModal");
    const cancelApply = document.getElementById("cancelApply");
    const applyForm = document.getElementById("applyForm");

    applyBtn.onclick = () => {
      if (!currentUser) {
        location.href = `/login.html?redirect=${encodeURIComponent(location.href)}`;
        return;
      }
      if (currentUser.role === 'employer') {
        toast("Employer accounts cannot apply for jobs", "error");
        return;
      }
      modal.style.display = "flex";
    };

    closeModal.onclick = () => { modal.style.display = "none"; };
    cancelApply.onclick = () => { modal.style.display = "none"; };

    applyForm.onsubmit = async (e) => {
      e.preventDefault();
      const fileInput = applyForm.elements["resume"];
      if (!fileInput.files || !fileInput.files[0]) {
        toast("Please select a resume file to upload", "error");
        return;
      }
      const formData = new FormData(applyForm);
      const submitBtn = document.getElementById("submitApply");
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";

      try {
        await api.post(`/applications/${id}`, formData);
        modal.style.display = "none";
        toast("Application submitted successfully!");
        applyBtn.disabled = true;
        applyBtn.className = "btn btn-secondary full";
        applyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Applied';
      } catch (err) {
        toast(err.message || "Failed to submit application", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
      }
    };

    saveBtn.onclick = async () => {
      if (!currentUser) {
        location.href = `/login.html?redirect=${encodeURIComponent(location.href)}`;
        return;
      }
      try {
        if (isSaved) {
          await api.delete(`/saved-jobs/${id}`);
          isSaved = false;
          saveBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Save job';
          toast("Job removed from saved list");
        } else {
          await api.post(`/saved-jobs/${id}`);
          isSaved = true;
          saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved';
          toast("Job saved successfully");
        }
      } catch (e) {
        toast(e.message, "error");
      }
    };
  } catch (e) {
    root.innerHTML = `<div class="loading-box">${escapeHtml(e.message)}</div>`;
  }
}
