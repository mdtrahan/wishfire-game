#!/usr/bin/env python3
import os

def main():
    print("Health check: OK")
    env_var = os.environ.get("CODEX_ORKA_TEST_VAR")
    if env_var:
        print(f"Environment variable CODEX_ORKA_TEST_VAR={env_var}")
    else:
        print("No CODEX_ORKA_TEST_VAR set (see .env.example)")

if __name__ == "__main__":
    main()
