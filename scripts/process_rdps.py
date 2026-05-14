#!/usr/bin/env python3
"""RDP Processor v2.2 — Estrutura RDPs + cruza Pessoas + SIBS + extrai PROFISSIONAIS ENVOLVIDOS."""
import os, sys, json, re, shutil, argparse
from datetime import datetime, timedelta
from pathlib import Path
from difflib import SequenceMatcher
import urllib.request
import urllib.error
import urllib.parse

ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = ROOT.parent
RDP_DIR = PROJECT_ROOT / "RDP"
DATA_DIR = ROOT / "data"
BACKUP_DIR = ROOT / "_backup"
LOGS_DIR = ROOT / "logs"
for d in (DATA_DIR, BACKUP_DIR, LOGS_DIR):
    d.mkdir(exist_ok=True)


class Log:
    def __init__(self):
        self.lines = []
        self.start = datetime.now()
        self.errors = 0
        self.warnings = 0
    def info(self, m):
        self._w("INFO", m)
    def warn(self, m):
        self.warnings += 1
        self._w("WARN", m)
    def err(self, m):
        self.errors += 1
        self._w("ERR ", m)
    def _w(self, lvl, m):
        line = "[" + datetime.now().strftime("%H:%M:%S") + "] " + lvl + "  " + str(m)
        print(line, file=sys.stderr if lvl == "ERR " else sys.stdout)
        self.lines.append(line)
    def save(self):
        p = LOGS_DIR / ("process_" + self.start.strftime("%Y%m%d_%H%M%S") + ".log")
        p.write_text("\n".join(self.lines), encoding="utf-8")
        return p

log = Log()


def atomic_write(path, content, validate_json=False):
    p = Path(path)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    raw = tmp.read_bytes()
    if b"\x00" in raw:
        tmp.unlink()
        raise RuntimeError("null bytes em " + str(tmp))
    if validate_json:
        try:
            json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as e:
            tmp.unlink()
            raise RuntimeError("JSON invalido: " + str(e))
    os.replace(tmp, p)
    return len(raw)


def backup(path):
    p = Path(path)
    if not p.exists():
        return
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(p, BACKUP_DIR / (p.stem + "_" + ts + p.suffix))


def load_pessoas():
    p = DATA_DIR / "pessoas.json"
    if not p.exists():
        log.warn("pessoas.json ausente")
        return []
    raw = json.loads(p.read_text(encoding="utf-8"))
    # Filtro defensivo: remove linhas invalidas (Totais, sem email, sem nome)
    invalid_names = ("totais", "total", "soma", "subtotal", "")
    return [
        x for x in raw
        if x.get("nome") and x.get("email") and "@" in x.get("email", "")
        and x["nome"].strip().lower() not in invalid_names
    ]


def load_projetos_index():
    p = DATA_DIR / "projetos_index.json"
    if not p.exists():
        log.warn("projetos_index.json ausente")
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def normalize_name(s):
    if not s:
        return ""
    s = re.sub(r"[^\w\s]", " ", str(s).lower()).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def match_pessoa(nome_extraido, pessoas):
    if not nome_extraido or not pessoas:
        return None
    target = normalize_name(nome_extraido)
    if not target:
        return None
    best = None
    best_score = 0.0
    for p in pessoas:
        norm_p_nome = normalize_name(p["nome"])
        score = SequenceMatcher(None, target, norm_p_nome).ratio()
        t = target.split()
        pp = norm_p_nome.split()

        if t and pp:
            # Bonus se primeiro nome coincide
            if t[0] == pp[0]:
                score += 0.15
            # Bonus se todos os nomes do extraido estao em sequencia no nome completo
            t_str = " ".join(t)
            if t_str in norm_p_nome:
                score += 0.25
            # Bonus se ultimos nomes coincidem
            if len(t) > 1 and len(pp) > 1 and t[-1] == pp[-1]:
                score += 0.1

        if score > best_score:
            best_score = score
            best = p

    # Threshold reduzido de 0.65 para 0.60 para capturar abreviacoes
    return best if best_score >= 0.60 else None


def extract_pdf(p):
    try:
        import pdfplumber
        with pdfplumber.open(p) as pdf:
            return "\n".join((pg.extract_text() or "") for pg in pdf.pages)
    except Exception as e:
        log.warn("pdfplumber " + p.name + ": " + str(e))
    try:
        from pypdf import PdfReader
        return "\n".join((pg.extract_text() or "") for pg in PdfReader(str(p)).pages)
    except Exception as e:
        log.err("pypdf " + p.name + ": " + str(e))
        return ""


def extract_docx(p):
    try:
        import docx2txt
        return docx2txt.process(str(p)) or ""
    except Exception as e:
        log.err("docx2txt " + p.name + ": " + str(e))
        return ""


def extract_text(p):
    if not p.exists():
        log.warn("ausente: " + p.name)
        return ""
    if p.stat().st_size == 0:
        log.warn("placeholder: " + p.name)
        return ""
    ext = p.suffix.lower()
    try:
        if ext == ".pdf":
            return extract_pdf(p)
        if ext in (".docx", ".doc"):
            return extract_docx(p)
    except OSError as e:
        if "Invalid argument" in str(e):
            log.warn("cloud-only: " + p.name)
            return ""
        log.err("OSError " + p.name + ": " + str(e))
    return ""


RE_DATA = re.compile(r"(\d{4}-\d{2}-\d{2})")
RE_EQUIPE = re.compile(r"\b(SDAI|SEC|BMS|SEG|AV|Security)\b", re.I)


def extract_codes(s):
    if not s:
        return []
    out = []
    for pat in [r"PRJ\d+", r"ASV\d+", r"CTR\d+"]:
        out += re.findall(pat, s)
    return out


def normalize_date(s):
    """Aceita YYYY-MM-DD valida; corrige YYYY-DD-MM se mes>12 e dia<=12; senao retorna None."""
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if not m:
        return None
    yyyy, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # Se mm valido, ok
    if 1 <= mm <= 12 and 1 <= dd <= 31:
        try:
            datetime(yyyy, mm, dd)
            return f"{yyyy:04d}-{mm:02d}-{dd:02d}"
        except ValueError:
            return None
    # Se mm invalido (>12) e dd valido (<=12), assume swap dia<->mes
    if mm > 12 and 1 <= dd <= 12:
        try:
            datetime(yyyy, dd, mm)
            return f"{yyyy:04d}-{dd:02d}-{mm:02d}"
        except ValueError:
            return None
    return None


def parse_filename(filename):
    info = {"codes": extract_codes(filename)}
    m = RE_DATA.search(filename)
    if m:
        normed = normalize_date(m.group(1))
        if normed:
            info["data"] = normed
    m = RE_EQUIPE.search(filename)
    if m:
        info["sistema"] = m.group(1).upper()
    base = filename.rsplit(".", 1)[0]
    parts = re.split(r"_RDP_(?:\([^)]*\)|[A-Z]+)_?", base)
    if len(parts) > 1:
        nome = parts[-1].replace("_", " ").replace("-", " ").strip()
        nome = re.sub(r"\s+R\d+$", "", nome)
        info["responsavel_nome"] = nome
    return info


def split_sections(text):
    sections = {}
    if not text:
        return sections
    pats = {
        "atividades": r"(atividades?\s+(?:realizadas?|do\s+dia|executadas?)|atividades?\s*:)",
        "pendencias": r"(pend[êe]ncias?|impedimentos?)",
        "bloqueios": r"(bloqueios?|riscos?|problemas?\s+identificados?)",
        "proximos": r"(pr[óo]ximos?\s+passos?|next\s+steps)",
    }
    lo = text.lower()
    pos = sorted([(m.start(), key) for key, pat in pats.items() for m in re.finditer(pat, lo)])
    for i, (start, key) in enumerate(pos):
        end = pos[i+1][0] if i+1 < len(pos) else len(text)
        sections[key] = text[start:end].strip()[:5000]
    return sections


def extract_bullets(text, max_items=15):
    if not text:
        return []
    items = []
    for line in text.split("\n"):
        line = line.strip()
        if re.match(r"^[•\-*●▪◦]\s+", line) or re.match(r"^\d+[\.\)]\s+", line):
            cleaned = re.sub(r"^[•\-*●▪◦\d\.\)]+\s+", "", line).strip()
            if cleaned and len(cleaned) > 5:
                items.append(cleaned[:400])
        if len(items) >= max_items:
            break
    return items


def extract_atividades_status(text):
    """Extrai linhas de atividade com status problemático (Paralisado/Pendente/Não-Solucionado/Atrasado)."""
    if not text:
        return []
    out = []
    # Padroes de status problematico
    status_problematicos = ["Paralisad", "Pendente", "Não-Solucionado", "Nao-Solucionado", "Atrasad", "Bloqueado", "Não Solucionado"]
    # Tabela ATIVIDADES tem formato: NUM TEXTO Ambiente Criticidade STATUS
    # Busca linhas que terminam com um desses status
    for line in text.split("\n"):
        line = line.strip()
        if len(line) < 10 or len(line) > 300:
            continue
        for st in status_problematicos:
            if re.search(r"\b" + re.escape(st) + r"\b", line, re.I):
                # Limpa: remove numero inicial, ambiente e criticidade do final
                cleaned = re.sub(r"^\d+\s+", "", line)
                # Remove o status do final
                cleaned = re.sub(r"\s+(?:Alta|Média|Media|Baixa|Crítica|Critica|N/A)?\s*" + re.escape(st) + r"[a-zçãéí]*\s*$", "", cleaned, flags=re.I).strip()
                if cleaned and len(cleaned) > 8 and not cleaned.lower().startswith(("status", "atividades", "criticidade", "pendente", "paralisad")):
                    out.append({"desc": cleaned + " [STATUS: " + st.replace("Paralisad","Paralisada").replace("Atrasad","Atrasada") + "]", "fonte": "atividade_status"})
                break
    return out


def extract_pendencias_prosa(text):
    """Captura frases em prosa que indicam pendência."""
    if not text:
        return []
    out = []
    seen_signatures = set()
    # Padrões: frases com palavras-chave de pendência
    # Pega frase completa terminando em ponto
    keywords = r"(?:aguardando|ainda\s+falta|pendente\s+(?:de|do|da|para)|atividade\s+paralisada|não\s+foi\s+possível|não\s+foi\s+liberad|não\s+está\s+(?:comunic|funciona)|sem\s+comunicação|sem\s+acesso\s+físico)"
    for m in re.finditer(r"([A-ZÀ-Úa-zà-ú0-9][^.\n]{15,300}" + keywords + r"[^.\n]{0,200}\.?)", text, re.I):
        frase = m.group(1).strip()
        # Remove quebras de linha internas
        frase = re.sub(r"\s+", " ", frase)
        # Limita
        if len(frase) > 350:
            frase = frase[:347] + "..."
        # Filtra ruído (textos de boilerplate do template)
        if re.search(r"(elabora[çc][aã]o|aprova[çc][aã]o|relat[óo]rio fotogr|sistema de gest[ãa]o)", frase, re.I):
            continue
        sig = frase.lower()[:80]
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)
        out.append({"desc": frase, "fonte": "prosa"})
    return out


def desgrudar_nome(s):
    """Insere espaco entre palavras grudadas (CamelCase) — ex: NoéliodeBrito -> Noélio de Brito."""
    if not s:
        return ""
    # 1. Insere espaço ANTES de preposições (de, do, da, dos, das) que vêm coladas
    # Padrão: letra + 'de/do/da/dos/das' + maiúscula
    s = re.sub(r"([a-záéíóúâêôãõçà])(de|do|da|dos|das)([A-ZÁÉÍÓÚÂÊÔÃÕÇÀ])", r"\1 \2 \3", s)

    # 2. Insere espaço ANTES de maiúscula precedida por minúscula (CamelCase)
    # Exemplo: "Noélio" + "Brito" = "NoélioBrito" → "Noélio Brito"
    s = re.sub(r"([a-záéíóúâêôãõçà])([A-ZÁÉÍÓÚÂÊÔÃÕÇÀ])", r"\1 \2", s)

    # 3. Normaliza múltiplos espaços
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_profissionais(text):
    """Extrai profissionais da secao PROFISSIONAIS ENVOLVIDOS."""
    if not text:
        return []
    # Regex permissivo: aceita PROFISSIONAIS ENVOLVIDOS sem espaco (PROFISSIONAISENVOLVIDOS)
    m = re.search(
        r"PROFISSIONAIS\s*ENVOLVIDOS(.{0,2500}?)(?:DESCRI[ÇC][AOÃÂ]O|DETALHAMENTO|RELAT[ÓO]?RIO\s*FOTOGR|ATIVIDADES?\s*REALIZADAS?|RESUMO\s*EVOLUTIVO|<\?>>>)",
        text, re.S | re.I)
    if not m:
        return []
    trecho = m.group(1)
    nomes = []
    # Padrao A: PDF compacto, pode ter nomes COM espaco ou GRUDADOS
    for mm in re.finditer(r"(?:^|\n)\s*(\d+)\s+([A-ZÀ-Ú][A-Za-zÀ-ú\s\.]+?)\s+(Convergint|CONVERGINT|TERCEIRO|TERCEIROS)\s+(\w+)", trecho):
        raw_nome = mm.group(2).strip()
        # IMPORTANTE: Sempre desgrudar, pois pode estar "NoéliodeBritoOliveira"
        desacoplado = desgrudar_nome(raw_nome)
        nomes.append(desacoplado)
    # Padrao B: DOCX expandido (com quebras de linha entre campos)
    if not nomes:
        for mm in re.finditer(r"\n\s*(\d+)\s*\n+([A-ZÀ-Ú][A-Za-zÀ-ú\s\.]+?)\n+\s*(Convergint|CONVERGINT|TERCEIRO|TERCEIROS)\b", trecho):
            nomes.append(mm.group(2).strip())
    seen = set()
    out = []
    for n in nomes:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n)
    return out


def estrutura_rdp(file_path, text, pessoas, proj_idx):
    meta = parse_filename(file_path.name)
    sections = split_sections(text)
    atividades = extract_bullets(sections.get("atividades", "")) or extract_bullets(text)[:15]

    # Pendências: 3 fontes — secao formal + status de atividade + prosa
    pendencias_set = set()
    pendencias_raw = []

    # Fonte 1: bullets da seção formal "PENDÊNCIAS"
    for p in extract_bullets(sections.get("pendencias", "")):
        sig = p.strip().lower()[:80]
        if sig not in pendencias_set:
            pendencias_set.add(sig)
            pendencias_raw.append(p)

    # Fonte 2: atividades com status problemático (Paralisado/Pendente/etc)
    for item in extract_atividades_status(text):
        desc = item["desc"]
        sig = desc.strip().lower()[:80]
        if sig not in pendencias_set:
            pendencias_set.add(sig)
            pendencias_raw.append(desc)

    # Fonte 3: frases em prosa (aguardando, ainda falta, etc)
    for item in extract_pendencias_prosa(text):
        desc = item["desc"]
        sig = desc.strip().lower()[:80]
        if sig not in pendencias_set:
            pendencias_set.add(sig)
            pendencias_raw.append(desc)

    bloqueios_raw = extract_bullets(sections.get("bloqueios", ""))
    proximos = extract_bullets(sections.get("proximos", ""))

    profissionais_extraidos = extract_profissionais(text)
    participantes = []
    for nome_extr in profissionais_extraidos:
        p_match = match_pessoa(nome_extr, pessoas)
        if p_match:
            participantes.append({"nome": p_match["nome"], "email": p_match["email"], "equipe": p_match["equipe"], "match": True, "nome_extraido": nome_extr})
        else:
            participantes.append({"nome": nome_extr, "email": "", "equipe": "-", "match": False, "nome_extraido": nome_extr})

    nome_arq = meta.get("responsavel_nome", "")
    pessoa = match_pessoa(nome_arq, pessoas)
    responsavel = pessoa["nome"] if pessoa else (nome_arq or "-")
    equipe = pessoa["equipe"] if pessoa else "-"
    email = pessoa["email"] if pessoa else ""
    disciplina = pessoa["disciplina"] if pessoa else (meta.get("sistema") or "-")

    projeto_info = None
    for code in meta.get("codes", []):
        if code in proj_idx:
            projeto_info = proj_idx[code]
            break

    return {
        "arquivo": file_path.name,
        "data": meta.get("data") or file_path.parent.name,
        "responsavel": responsavel,
        "responsavel_arquivo": nome_arq,
        "responsavel_match": pessoa is not None,
        "participantes": participantes,
        "email": email,
        "equipe": equipe,
        "disciplina": disciplina,
        "sistema": meta.get("sistema") or disciplina,
        "projeto_codigo": (meta.get("codes", [None])[0]) if meta.get("codes") else None,
        "projeto_nome": projeto_info["desc"] if projeto_info else "-",
        "projeto_cliente": projeto_info["client"] if projeto_info else "-",
        "projeto_categoria": projeto_info["category"] if projeto_info else "-",
        "projeto_uf": projeto_info["uf"] if projeto_info else "-",
        "projeto_segmento": projeto_info["segment"] if projeto_info else "-",
        "projeto_bu": projeto_info["business_unit"] if projeto_info else "-",
        "atividades": atividades,
        "pendencias": pendencias_raw,
        "bloqueios": bloqueios_raw,
        "proximos": proximos,
        "texto_full": text[:8000],
        "tamanho_bytes": file_path.stat().st_size,
    }


def get_target_dates(args):
    if args.all:
        return sorted([d.name for d in RDP_DIR.iterdir() if d.is_dir() and RE_DATA.match(d.name)]) if RDP_DIR.exists() else []
    if args.date:
        return [args.date]
    today = datetime.now().date()
    return [(today - timedelta(days=1)).isoformat(), today.isoformat()]


def build_pendencias_global(rdps):
    out = []
    seen = set()
    next_id = 1
    for r in sorted(rdps, key=lambda x: x.get("data", "")):
        for desc in r.get("pendencias", []):
            key = (r.get("projeto_codigo") or "?", desc.strip().lower()[:80])
            if key in seen:
                continue
            seen.add(key)
            prio = "Alta" if any(w in desc.lower() for w in ["urgente", "critico", "crítico", "bloqueio", "parado", "atrasado"]) else "Normal"
            out.append({
                "id": next_id, "descricao": desc,
                "responsavel": r["responsavel"], "equipe": r["equipe"],
                "projeto_codigo": r["projeto_codigo"], "projeto_nome": r["projeto_nome"],
                "projeto_cliente": r["projeto_cliente"],
                "sistema": r["sistema"], "prioridade": prio,
                "status": "Aberta", "data_abertura": r["data"],
                "origem_rdp": r["arquivo"]
            })
            next_id += 1
    return out


def build_projetos_consolidado(rdps, proj_idx):
    by_proj = {}
    for r in rdps:
        code = r.get("projeto_codigo")
        if not code:
            continue
        if code not in by_proj:
            by_proj[code] = {
                "codigo": code, "nome": r["projeto_nome"], "cliente": r["projeto_cliente"],
                "uf": r["projeto_uf"], "categoria": r["projeto_categoria"],
                "segmento": r["projeto_segmento"], "business_unit": r["projeto_bu"],
                "rdps": [], "pendencias_por_sistema": {}, "ultimo_rdp": ""
            }
        by_proj[code]["rdps"].append({
            "data": r["data"], "responsavel": r["responsavel"],
            "sistema": r["sistema"], "arquivo": r["arquivo"],
            "n_atividades": len(r.get("atividades", [])),
            "n_pendencias": len(r.get("pendencias", [])),
            "participantes": [p["nome"] for p in r.get("participantes", [])]
        })
        if r["data"] > by_proj[code]["ultimo_rdp"]:
            by_proj[code]["ultimo_rdp"] = r["data"]
        sis = r["sistema"] or "-"
        if sis not in by_proj[code]["pendencias_por_sistema"]:
            by_proj[code]["pendencias_por_sistema"][sis] = []
        for p in r.get("pendencias", []):
            by_proj[code]["pendencias_por_sistema"][sis].append({
                "data": r["data"], "desc": p, "responsavel": r["responsavel"]
            })
    return sorted(by_proj.values(), key=lambda x: x["ultimo_rdp"], reverse=True)


def load_supabase_config():
    """Carrega credenciais Supabase de variáveis de ambiente ou .env"""
    # Tenta carregar de .env
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()

    return url, key


def sync_rdps_to_supabase(rdps_data, url, key):
    """Sincroniza RDPs processados com tabela 'rdps' no Supabase via REST API"""
    if not url or not key:
        log.warn("Supabase nao configurado (SUPABASE_URL ou SUPABASE_KEY ausentes)")
        return 0

    if not rdps_data:
        log.info("Sem RDPs para sincronizar")
        return 0

    synced = 0
    failed = 0

    # Teste de conexao
    try:
        test_url = f"{url}/rest/v1/rdps?limit=1&select=id"
        test_req = urllib.request.Request(
            test_url,
            headers={"apikey": key}
        )
        with urllib.request.urlopen(test_req, timeout=5) as resp:
            log.info(f"Supabase conectado: {resp.status}")
    except urllib.error.HTTPError as e:
        log.err(f"Supabase indisponivel: HTTP {e.code}")
        log.err(f"  Verifique: SUPABASE_URL e SUPABASE_KEY no .env")
        log.err(f"  Ou verifique se tabela 'rdps' existe no Supabase")
        return 0
    except Exception as e:
        log.err(f"Erro conectando Supabase: {str(e)}")
        return 0

    # Detecta colunas disponiveis (evita erro 400 quando schema difere entre ambientes)
    available_cols = set()
    try:
        schema_url = f"{url}/rest/v1/rdps?limit=1&select=*"
        schema_req = urllib.request.Request(schema_url, headers={"apikey": key})
        with urllib.request.urlopen(schema_req, timeout=8) as resp:
            rows = json.loads(resp.read().decode("utf-8") or "[]")
            if rows and isinstance(rows, list) and isinstance(rows[0], dict):
                available_cols = set(rows[0].keys())
    except Exception:
        # Se falhar, segue com payload minimo (colunas ja testadas anteriormente)
        available_cols = set()

    # Processa RDPs em lotes pequenos
    for i, rdp in enumerate(rdps_data):
        try:
            # Payload com campos necessarios para dashboard
            payload = {
                "arquivo": rdp.get("arquivo", ""),
                "data": rdp.get("data"),
                "responsavel": rdp.get("responsavel", ""),
                "email": rdp.get("email", ""),
                "equipe": rdp.get("equipe", ""),
                "projeto_codigo": rdp.get("projeto_codigo", ""),
                "sistema": rdp.get("sistema"),
                "participantes": rdp.get("participantes", []),
                "n_atividades": len(rdp.get("atividades", [])),
                "n_pendencias": len(rdp.get("pendencias", [])),
            }
            if not available_cols or "email" in available_cols:
                payload["email"] = rdp.get("email", "")
            if not available_cols or "equipe" in available_cols:
                payload["equipe"] = rdp.get("equipe", "")
            if not available_cols or "participantes" in available_cols:
                payload["participantes"] = rdp.get("participantes", [])

            # Remove None values para evitar erro 400
            payload = {k: v for k, v in payload.items() if v is not None}

            if not payload.get("arquivo"):
                log.warn(f"RDP {i}: sem arquivo, pulando")
                failed += 1
                continue

            # Atualiza por arquivo (PATCH) e, se nao existir, insere (POST)
            arquivo_q = urllib.parse.quote(payload["arquivo"], safe="")
            try:
                inserted = False
                with urllib.request.urlopen(urllib.request.Request(
                    f"{url}/rest/v1/rdps?arquivo=eq.{arquivo_q}",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "apikey": key,
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    method="PATCH"
                ), timeout=10) as resp:
                    body = resp.read().decode("utf-8") or "[]"
                    updated_rows = json.loads(body) if body else []
                    inserted = not bool(updated_rows)

                if inserted:
                    post_req = urllib.request.Request(
                        f"{url}/rest/v1/rdps",
                        data=json.dumps([payload]).encode("utf-8"),
                        headers={
                            "apikey": key,
                            "Content-Type": "application/json",
                            "Prefer": "return=representation"
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(post_req, timeout=10) as resp:
                        if resp.status not in (200, 201):
                            raise urllib.error.HTTPError(post_req.full_url, resp.status, "post failed", resp.headers, None)
                synced += 1
            except urllib.error.HTTPError as e:
                if e.code == 400:
                    # Bad Request = schema problem
                    log.warn(f"Sync {payload['arquivo']}: HTTP 400")
                    log.warn(f"  Verifique schema da tabela rdps no Supabase")
                    log.warn(f"  Payload: {payload}")
                else:
                    log.warn(f"Sync {payload['arquivo']}: HTTP {e.code}")
                failed += 1
        except Exception as e:
            # Fallback defensivo para ambientes que ainda executam cache/codigo antigo
            # e retornam NameError relacionado a patch_url.
            if "patch_url" in str(e):
                try:
                    arquivo_q = urllib.parse.quote(payload.get("arquivo", ""), safe="")
                    with urllib.request.urlopen(urllib.request.Request(
                        f"{url}/rest/v1/rdps?arquivo=eq.{arquivo_q}",
                        data=json.dumps(payload).encode("utf-8"),
                        headers={
                            "apikey": key,
                            "Content-Type": "application/json",
                            "Prefer": "return=representation"
                        },
                        method="PATCH"
                    ), timeout=10) as resp:
                        body = resp.read().decode("utf-8") or "[]"
                        updated_rows = json.loads(body) if body else []
                    if not updated_rows:
                        with urllib.request.urlopen(urllib.request.Request(
                            f"{url}/rest/v1/rdps",
                            data=json.dumps([payload]).encode("utf-8"),
                            headers={
                                "apikey": key,
                                "Content-Type": "application/json",
                                "Prefer": "return=representation"
                            },
                            method="POST"
                        ), timeout=10):
                            pass
                    synced += 1
                    continue
                except Exception as e2:
                    log.err(f"Sync RDP {i} fallback: {str(e2)}")
            log.err(f"Sync RDP {i}: {str(e)}")
            failed += 1

    if synced > 0 or failed == 0:
        log.info(f"RDPs processados Supabase: {synced} (falhas: {failed})")

    return synced


def check_dependencies():
    """Verifica se as bibliotecas obrigatorias estao instaladas."""
    missing = []
    for mod in ("pdfplumber", "docx2txt"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        print("=" * 60)
        print("  ERRO: bibliotecas Python ausentes: " + ", ".join(missing))
        print("=" * 60)
        print("")
        print("  Solucao: rode setup.bat (Windows) ou:")
        print("     pip install -r requirements.txt --break-system-packages")
        print("")
        print("  Para mais ajuda, abra COMECE-AQUI.txt")
        print("=" * 60)
        return False
    return True


def main():
    if not check_dependencies():
        return 1

    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--date")
    args = ap.parse_args()

    log.info("=== process_rdps.py v2.3 ===")
    log.info("RDP: " + str(RDP_DIR) + " | OUT: " + str(DATA_DIR))

    if not RDP_DIR.exists():
        log.err("sem " + str(RDP_DIR))
        return 1

    pessoas = load_pessoas()
    proj_idx = load_projetos_index()
    log.info("Pessoas: " + str(len(pessoas)) + " | Projetos: " + str(len(proj_idx)))

    target = get_target_dates(args)
    log.info("Datas alvo: " + str(target))

    arquivos = []
    for d in target:
        sub = RDP_DIR / d
        if not sub.exists():
            log.warn("sem pasta " + str(sub))
            continue
        for f in sub.iterdir():
            if f.suffix.lower() in (".pdf", ".docx", ".doc"):
                arquivos.append(f)
    log.info("Arquivos: " + str(len(arquivos)))

    novos = []
    for f in arquivos:
        log.info("-> " + f.name)
        try:
            text_f = extract_text(f)
            if not text_f.strip():
                log.warn("sem texto: " + f.name)
                continue
            r = estrutura_rdp(f, text_f, pessoas, proj_idx)
            log.info("   pendencias: " + str(len(r["pendencias"])) + " | participantes: " + str([p["nome"] for p in r["participantes"]]))
            novos.append(r)
        except Exception as e:
            log.err("falhou " + f.name + ": " + str(e))
    log.info("Estruturados: " + str(len(novos)))

    rdps_path = DATA_DIR / "rdps.json"
    existing = []
    if rdps_path.exists():
        try:
            existing = json.loads(rdps_path.read_text(encoding="utf-8"))
        except:
            log.warn("rdps.json ilegivel")
            existing = []
    by_file = {r["arquivo"]: r for r in existing}
    for r in novos:
        by_file[r["arquivo"]] = r
    all_rdps = sorted(by_file.values(), key=lambda x: x.get("data", ""), reverse=True)

    for f in ("rdps.json", "pendencias.json", "projetos.json", "dashboard_data.js", "meta.json"):
        backup(DATA_DIR / f)

    pendencias_global = build_pendencias_global(all_rdps)
    projetos_consol = build_projetos_consolidado(all_rdps, proj_idx)

    today = datetime.now().date().isoformat()
    meta = {
        "generatedAt": datetime.now().isoformat(),
        "today": today, "version": "2.3.0",
        "rdps_total": len(all_rdps),
        "pendencias_total": len(pendencias_global),
        "projetos_total": len(projetos_consol),
        "pessoas_total": len(pessoas),
        "datas_processadas": target,
        "warnings": log.warnings, "errors": log.errors,
    }

    atomic_write(rdps_path, json.dumps(all_rdps, ensure_ascii=False, indent=2), validate_json=True)
    atomic_write(DATA_DIR / "pendencias.json", json.dumps(pendencias_global, ensure_ascii=False, indent=2), validate_json=True)
    atomic_write(DATA_DIR / "projetos.json", json.dumps(projetos_consol, ensure_ascii=False, indent=2), validate_json=True)
    atomic_write(DATA_DIR / "meta.json", json.dumps(meta, ensure_ascii=False, indent=2), validate_json=True)

    consolidated = {
        "rdps": all_rdps, "pendencias": pendencias_global, "projetos": projetos_consol,
        "pessoas": pessoas, "meta": meta
    }
    atomic_write(DATA_DIR / "dashboard_data.js",
                 "window.RDP_DATA = " + json.dumps(consolidated, ensure_ascii=False) + ";\n")

    # Sincroniza com Supabase
    log.info("=== Iniciando sincronizacao com Supabase ===")
    supabase_url, supabase_key = load_supabase_config()
    synced_count = sync_rdps_to_supabase(all_rdps, supabase_url, supabase_key)

    log.save()
    print("\n" + "="*60)
    print("  RDPs: " + str(len(all_rdps)) + " (novos: " + str(len(novos)) + ")")
    print("  Pendencias: " + str(len(pendencias_global)))
    print("  Projetos: " + str(len(projetos_consol)))
    print("  Sincronizados com Supabase: " + str(synced_count))
    print("  Erros: " + str(log.errors) + " | Warnings: " + str(log.warnings))
    print("="*60)
    return 0 if log.errors == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
