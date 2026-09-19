import 'dotenv/config';
import { AccessDeliveryService } from '../lib/delivery/access-delivery-service';

async function main() {
  const accessId = "d585d753-631c-4657-bd11-9d089702d5b5";
  const storeId = "09596d3e-6f66-4b61-9c09-7e4051190a10";

  console.log(`Retrying access delivery for access ${accessId}...`);
  const result = await AccessDeliveryService.retryAccessDelivery(accessId, storeId);
  console.log("RETRY RESULT:", JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
