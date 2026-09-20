// Data layer. Everything lives in a single file-backed Deno.openKv database,
// namespaced per event year:
//   ["reg",   year, id]     -> Signup record
//   ["email", year, email]  -> id    (email kept lowercase, for de-duplication)
//   ["meta",  "counter"]    -> next registration id
//   ["meta",  "year"]       -> active event year
// Nothing is deleted when the year rolls over, so old years stay archived.

const DEFAULT_KV_PATH = "data/app.kv";

export interface Signup {
  id: number;
  navn: string;
  email: string;
  besked: string;
  createdAt: string; // ISO 8601
}

let ready: Promise<Deno.Kv> | undefined;

function kvPath(): string {
  return Deno.env.get("KV_PATH") ?? DEFAULT_KV_PATH;
}

function getKv(): Promise<Deno.Kv> {
  if (!ready) {
    ready = (async () => {
      const path = kvPath();
      const slash = path.lastIndexOf("/");
      if (slash > 0) {
        await Deno.mkdir(path.slice(0, slash), { recursive: true });
      }
      return Deno.openKv(path);
    })();
  }
  return ready;
}

function defaultYear(): number {
  const fromEnv = Number.parseInt(Deno.env.get("EVENT_YEAR") ?? "", 10);
  return Number.isFinite(fromEnv) ? fromEnv : new Date().getFullYear();
}

export async function getCurrentYear(): Promise<number> {
  const kv = await getKv();
  const entry = await kv.get<number>(["meta", "year"]);
  if (entry.value !== null) return entry.value;
  const year = defaultYear();
  await kv.set(["meta", "year"], year);
  return year;
}

export async function setCurrentYear(year: number): Promise<void> {
  const kv = await getKv();
  await kv.set(["meta", "year"], year);
}

export async function nextYear(): Promise<number> {
  const year = (await getCurrentYear()) + 1;
  await setCurrentYear(year);
  return year;
}

export type AddSignupResult =
  | { status: "ok"; signup: Signup; count: number }
  | { status: "duplicate" };

export async function addSignup(
  year: number,
  data: Pick<Signup, "navn" | "email" | "besked">,
): Promise<AddSignupResult> {
  const navn = data.navn.trim();
  const email = data.email.trim().toLowerCase();
  const besked = data.besked.trim();

  const kv = await getKv();
  const existing = await kv.get<number>(["email", year, email]);
  if (existing.value !== null) return { status: "duplicate" };

  // The atomic commit keeps the counter, the registration and the email index
  // consistent even if two people register the same address at once.
  for (let attempt = 0; attempt < 3; attempt++) {
    const counter = await kv.get<number>(["meta", "counter"]);
    const id = (counter.value ?? 0) + 1;
    const signup: Signup = {
      id,
      navn,
      email,
      besked,
      createdAt: new Date().toISOString(),
    };
    const res = await kv
      .atomic()
      .set(["meta", "counter"], id)
      .set(["reg", year, id], signup)
      .set(["email", year, email], id)
      .commit();
    if (res.ok) {
      const count = await countSignups(year);
      return { status: "ok", signup, count };
    }
  }
  return { status: "duplicate" };
}

export async function listSignups(year: number): Promise<Signup[]> {
  const kv = await getKv();
  const signups: Signup[] = [];
  for await (const entry of kv.list<Signup>({ prefix: ["reg", year] })) {
    signups.push(entry.value);
  }
  signups.sort((a, b) => a.id - b.id);
  return signups;
}

export async function countSignups(year: number): Promise<number> {
  return (await listSignups(year)).length;
}

export async function deleteSignup(year: number, id: number): Promise<boolean> {
  const kv = await getKv();
  const entry = await kv.get<Signup>(["reg", year, id]);
  if (entry.value === null) return false;
  await kv
    .atomic()
    .delete(["reg", year, id])
    .delete(["email", year, entry.value.email])
    .commit();
  return true;
}
