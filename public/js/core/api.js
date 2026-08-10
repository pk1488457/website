const API_BASE = window.API_BASE || "/api/v1";
async function request(path, options = {}) {
  const opts = {...options, credentials:"include", headers:{...(options.body instanceof FormData ? {} : {"Content-Type":"application/json"}), ...(options.headers||{})}};
  const res = await fetch(`${API_BASE}${path}`, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = data.error || data.message || "Something went wrong.";
    throw new Error(msg);
  }
  return data;
}
export const api = {
  get:(p)=>request(p),
  post:(p,b)=>request(p,{method:"POST",body:b instanceof FormData?b:JSON.stringify(b)}),
  put:(p,b)=>request(p,{method:"PUT",body:b instanceof FormData?b:JSON.stringify(b)}),
  delete:(p)=>request(p,{method:"DELETE"}),
};
export async function getMe(){return api.get("/auth/me")}
export function qs(name){return new URLSearchParams(location.search).get(name)}
