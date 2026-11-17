"""
Tests for MongoDB TLS configuration, which is set only through MONGO_URI.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
import trustme
from pymongo import MongoClient
from pymongo.errors import ConfigurationError

import config

BACKEND_DIR = Path(__file__).resolve().parent.parent

REMOVED_TLS_VARS = [
    "MONGO_TLS_CA_FILE",
    "MONGO_TLS_CERT_FILE",
    "MONGO_TLS_KEY_FILE",
    "MONGO_SSL_CA_CERTS",
    "MONGO_SSL_CERTFILE",
    "MONGO_SSL_KEYFILE",
]


def import_config(extra_env):
    env = {k: v for k, v in os.environ.items() if k not in REMOVED_TLS_VARS}
    env.update(extra_env)
    return subprocess.run(
        [
            sys.executable,
            "-c",
            "import config; "
            "print(config.Config.MONGO_OPTIONS); "
            "print(config.ProductionConfig.MONGO_OPTIONS)",
        ],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


class TestRemovedTlsEnvVars:
    @pytest.mark.parametrize(
        "var, uri_option",
        [
            ("MONGO_TLS_CA_FILE", "tlsCAFile"),
            ("MONGO_SSL_CA_CERTS", "tlsCAFile"),
            ("MONGO_TLS_CERT_FILE", "tlsCertificateKeyFile"),
            ("MONGO_SSL_CERTFILE", "tlsCertificateKeyFile"),
            ("MONGO_TLS_KEY_FILE", "tlsCertificateKeyFile"),
            ("MONGO_SSL_KEYFILE", "tlsCertificateKeyFile"),
        ],
    )
    def test_import_fails_naming_var_and_uri_option(self, var, uri_option):
        result = import_config({var: "/certs/file.pem"})

        assert result.returncode != 0
        assert "ValueError" in result.stderr
        assert var in result.stderr
        assert uri_option in result.stderr
        assert "MONGO_URI" in result.stderr

    def test_import_fails_naming_every_var_set(self):
        result = import_config(
            {
                "MONGO_TLS_CA_FILE": "/certs/ca.pem",
                "MONGO_SSL_KEYFILE": "/certs/key.pem",
            }
        )

        assert result.returncode != 0
        assert "MONGO_TLS_CA_FILE" in result.stderr
        assert "MONGO_SSL_KEYFILE" in result.stderr

    def test_import_succeeds_without_removed_vars(self):
        result = import_config({})

        assert result.returncode == 0, result.stderr
        assert result.stdout.splitlines() == [
            "{'uuidRepresentation': 'standard'}",
            "{'uuidRepresentation': 'standard'}",
        ]


class TestTlsThroughMongoUri:
    @pytest.fixture
    def certs(self, tmp_path):
        ca = trustme.CA()
        client_cert = ca.issue_cert("brewtracker-client")
        ca.cert_pem.write_to_path(str(tmp_path / "ca.pem"))
        client_cert.private_key_and_cert_chain_pem.write_to_path(
            str(tmp_path / "client.pem")
        )
        client_cert.cert_chain_pems[0].write_to_path(str(tmp_path / "cert-only.pem"))
        return tmp_path

    def tls_uri(self, ca_file, cert_key_file):
        return (
            "mongodb://localhost:27017/brewtracker"
            f"?tls=true&tlsCAFile={ca_file}&tlsCertificateKeyFile={cert_key_file}"
        )

    def test_combined_cert_and_key_pem_is_accepted(self, certs):
        client = MongoClient(
            self.tls_uri(certs / "ca.pem", certs / "client.pem"),
            connect=False,
            **config.Config.MONGO_OPTIONS,
        )
        client.close()

    def test_pem_without_key_is_rejected(self, certs):
        with pytest.raises(ConfigurationError, match="Private key"):
            MongoClient(
                self.tls_uri(certs / "ca.pem", certs / "cert-only.pem"),
                connect=False,
                **config.Config.MONGO_OPTIONS,
            )
