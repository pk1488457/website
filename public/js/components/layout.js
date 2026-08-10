import {getMe,api} from "../core/api.js";
import {toast,escapeHtml} from "../core/ui.js";
export async function renderLayout(){
 const nav=document.getElementById("navbar"), footer=document.getElementById("footer");
  let user=null; try{const r=await getMe();user=r.data||r.user}catch{}
  const userName = user ? (user.name || user.data?.name || user.user?.name || "Profile") : "Profile";
  const dashUrl = user?.role === "employer" ? "/employer/dashboard.html" : "/dashboard.html";
  if(nav) nav.innerHTML=`<div class="navbar"><div class="container nav-inner"><a class="brand" href="/"><span class="brand-mark">H</span>Hirely</a><nav class="nav-links" id="navLinks"><a href="/jobs.html">Find jobs</a><a href="/companies.html">Companies</a><a href="/resumes.html">Resume builder</a><a href="${dashUrl}">Dashboard</a></nav><div class="nav-actions">${user?`<button class="btn-ghost" id="logoutBtn">Logout</button><a class="btn btn-primary" href="/profile.html">${escapeHtml(userName)}</a>`:`<a class="btn-ghost" href="/login.html">Sign in</a><a class="btn btn-primary" href="/register.html">Get started</a>`}<button class="nav-toggle" id="navToggle"><i class="fa-solid fa-bars"></i></button></div></div></div>`;
 if(document.getElementById("logoutBtn"))document.getElementById("logoutBtn").onclick=async()=>{try{await api.get("/auth/logout")}catch{} location.href="/"}
 if(document.getElementById("navToggle"))document.getElementById("navToggle").onclick=()=>document.getElementById("navLinks").classList.toggle("open");
 if(footer)footer.innerHTML=`<div class="container"><div class="footer-grid"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark">H</span>Hirely</a><p>A modern career platform for ambitious people and teams.</p></div><div><h4>Explore</h4><a href="/jobs.html">Jobs</a><a href="/companies.html">Companies</a><a href="/resumes.html">Resume builder</a></div><div><h4>For employers</h4><a href="/employer/dashboard.html">Employer dashboard</a><a href="/employer/post-job.html">Post a job</a></div><div><h4>Company</h4><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a></div></div><div class="footer-bottom">© ${new Date().getFullYear()} Hirely. Built for better careers.</div></div>`;
}
