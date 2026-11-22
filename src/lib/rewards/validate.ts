export const BR_UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

const UFS = new Set(BR_UFS);

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

/** Validação dos dados de entrega do resgate da placa. */
export function validateRedemptionForm(fd: FormData):
  | { ok: true; data: { fullName: string; phone: string; zipCode: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; notes: string | null } }
  | { ok: false; error: string } {
  const fullName = field(fd, "fullName");
  const phone = field(fd, "phone").replace(/\D/g, "");
  const zipCode = field(fd, "zipCode").replace(/\D/g, "");
  const street = field(fd, "street");
  const number = field(fd, "number");
  const complement = field(fd, "complement") || null;
  const district = field(fd, "district");
  const city = field(fd, "city");
  const state = field(fd, "state").toUpperCase();
  const notes = field(fd, "notes").slice(0, 500) || null;

  if (fullName.length < 3) return { ok: false, error: "Informe o nome completo de quem vai receber." };
  if (phone.length < 10 || phone.length > 13) return { ok: false, error: "Informe um telefone com DDD." };
  if (zipCode.length !== 8) return { ok: false, error: "Informe um CEP válido (8 números)." };
  if (!street || !number || !district || !city) return { ok: false, error: "Preencha rua, número, bairro e cidade." };
  if (!UFS.has(state)) return { ok: false, error: "Escolha o estado (UF)." };

  return { ok: true, data: { fullName, phone, zipCode, street, number, complement, district, city, state, notes } };
}

