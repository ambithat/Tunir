from typing import Optional, Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sales.emailenv import EmailEnv
from app.security.security_utils import encrypt_password as fernet_encrypt, decrypt_password as fernet_decrypt


class EmailEnvRepository:
    """Repository for managing M365 email environment credentials in sales.emailenv."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active_emailenv(self) -> Optional[EmailEnv]:
        """
        Fetch active EmailEnv record, expunge it from the session, 
        and decrypt client_id, tenant_id, and client_secret with Fernet.
        """
        stmt = (
            select(EmailEnv)
            .where(EmailEnv.is_active == True)
            .order_by(EmailEnv.id.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        record = result.scalar_one_or_none()

        if record:
            # Expunge from session so setting decrypted fields in-memory does not flush plain text to DB
            self.session.expunge(record)
            if record.client_id:
                record.client_id = fernet_decrypt(record.client_id)
            if record.tenant_id:
                record.tenant_id = fernet_decrypt(record.tenant_id)
            if record.client_secret:
                record.client_secret = fernet_decrypt(record.client_secret)

        return record

    async def create_or_update_emailenv(
        self, client_id: str, tenant_id: str, client_secret: str, email_from: Optional[str] = None
    ) -> EmailEnv:
        """
        Encrypt M365 credentials using Fernet and save to sales.emailenv.
        """
        # Deactivate old active records
        await self.session.execute(
            update(EmailEnv).values(is_active=False)
        )
        await self.session.flush()

        enc_client_id = fernet_encrypt(client_id) if client_id else None
        enc_tenant_id = fernet_encrypt(tenant_id) if tenant_id else None
        enc_client_secret = fernet_encrypt(client_secret) if client_secret else None

        new_record = EmailEnv(
            client_id=enc_client_id,
            tenant_id=enc_tenant_id,
            client_secret=enc_client_secret,
            email_from=email_from,
            is_active=True
        )
        self.session.add(new_record)
        await self.session.flush()

        # Expunge and return decrypted record for caller
        self.session.expunge(new_record)
        new_record.client_id = client_id
        new_record.tenant_id = tenant_id
        new_record.client_secret = client_secret
        return new_record
