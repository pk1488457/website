import { api } from "../core/api.js";
import { toast } from "../core/ui.js";
import { renderLayout } from "../components/layout.js";

await renderLayout();
const form = document.getElementById("profileForm");

if (form) {
  try {
    const r = await api.get("/users/me");
    const u = r.data || {};
    Object.entries({
      name: u.name,
      email: u.email,
      phone: u.phone,
      location: u.location,
      headline: u.headline,
      bio: u.bio
    }).forEach(([k, v]) => {
      if (form.elements[k]) form.elements[k].value = v || "";
    });
  } catch (e) {
    toast("Please sign in to view your profile", "error");
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await api.put("/users/me", data);
      toast("Profile updated successfully!");
    } catch (err) {
      toast(err.message || "Failed to update profile", "error");
    }
  };
}
