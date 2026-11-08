"""The leak check shared by build-trace.py and extract-tools.py: what may never reach a published file.

find_leaks(obj, literals, user) walks every string (and dict key) in obj and returns a short excerpt
around each hit of:
- any of `literals` (the recording folder in all its spellings, session ids, ...), case-insensitive;
- the local user name as a word, case-insensitive;
- a home folder (":\\Users", "/Users/") or a drive path ("D:\\", "C:/");
- an email address. Claude Code sends the account's email to the model (RECORDING-05).
Two things are allowed: a home folder already redacted to "you" (C:\\Users\\you\\...), and the public
addresses in PUBLIC_EMAILS, which Claude Code itself writes. Callers can add patterns with `extra`.
"""
import re

PUBLIC_EMAILS = ("noreply@anthropic.com",)
REDACTED_HOME = re.compile(r"(?:[A-Za-z]:)?[\\/]Users[\\/]you(?=[\\/]|$)", re.I)


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, list):
        for x in obj:
            yield from strings(x)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from strings(v)


def patterns(literals, user):
    return [(re.escape(s), re.I) for s in literals if s] + [
        (rf"\b{re.escape(user)}\b", re.I),
        (r":\\Users", re.I),
        (r"/Users/", 0),
        (r"(?<![A-Za-z])[A-Za-z]:[\\/]", 0),  # a drive path such as D:\ or C:/
        (r"[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b", 0),  # an email address
    ]


def find_leaks(obj, literals, user, extra=()):
    """Return a short excerpt around each leak. Checks the strings themselves, not their JSON escapes."""
    pats = patterns(literals, user) + list(extra)
    hits = []
    for s in strings(obj):
        s = REDACTED_HOME.sub("~", s)
        for public in PUBLIC_EMAILS:
            s = s.replace(public, "")
        for pat, flags in pats:
            for m in re.finditer(pat, s, flags):
                hits.append(s[max(0, m.start() - 30):m.end() + 30].replace("\n", " "))
    return hits
