import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const jsonPath = path.join(rootDir, "node_modules", "@iconify-json", "solar", "icons.json");
const infoPath = path.join(rootDir, "node_modules", "@iconify-json", "solar", "info.json");
const outputDir = path.join(rootDir, "src", "components", "icons", "solar");
const outputFile = path.join(outputDir, "seller-icons.tsx");

if (!fs.existsSync(jsonPath)) {
  console.error(`Erro: Arquivo não encontrado: ${jsonPath}. Execute 'npm install -D @iconify-json/solar'.`);
  process.exit(1);
}

const iconsData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
const infoData = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, "utf-8")) : {};

// Mapeamento dos ícones Solar Line Duotone do Seller
export const SELLER_ICON_MAPPING = [
  // 1. Principal
  { id: "speedometer-middle-line-duotone", componentName: "SolarDashboardLineDuotone", alias: "SolarSellerDashboardIcon", label: "Dashboard", section: "Principal" },

  // 2. Bot Telegram
  { id: "bot-line-duotone", componentName: "SolarBotLineDuotone", alias: "SolarSellerBotIcon", label: "Configuração do Bot", section: "Bot Telegram" },
  { id: "magic-stick-2-line-duotone", componentName: "SolarMagicStickLineDuotone", alias: "SolarSellerWelcomeIcon", label: "Boas-vindas", section: "Bot Telegram" },
  { id: "gallery-wide-line-duotone", componentName: "SolarGalleryWideLineDuotone", alias: "SolarSellerBannersIcon", label: "Banners", section: "Bot Telegram" },
  { id: "box-line-duotone", componentName: "SolarBoxLineDuotone", alias: "SolarSellerProductsIcon", label: "Produtos", section: "Bot Telegram" },
  { id: "layers-minimalistic-line-duotone", componentName: "SolarLayersMinimalisticLineDuotone", alias: "SolarSellerCombosIcon", label: "Combos", section: "Bot Telegram" },
  { id: "clapperboard-play-line-duotone", componentName: "SolarClapperboardPlayLineDuotone", alias: "SolarSellerVideosIcon", label: "Biblioteca de Vídeos", section: "Bot Telegram" },
  { id: "slider-horizontal-line-duotone", componentName: "SolarSliderHorizontalLineDuotone", alias: "SolarSellerCarouselsIcon", label: "Carrosséis", section: "Bot Telegram" },
  { id: "tag-price-line-duotone", componentName: "SolarTagPriceLineDuotone", alias: "SolarSellerCategoriesIcon", label: "Categorias", section: "Bot Telegram" },
  { id: "videocamera-record-line-duotone", componentName: "SolarVideocameraRecordLineDuotone", alias: "SolarSellerClipsIcon", label: "Clips", section: "Bot Telegram" },
  { id: "bell-line-duotone", componentName: "SolarBellLineDuotone", alias: "SolarSellerNotificationsIcon", label: "Notificações", section: "Bot Telegram" },
  { id: "ticket-sale-line-duotone", componentName: "SolarTicketSaleLineDuotone", alias: "SolarSellerCouponsIcon", label: "Cupons", section: "Bot Telegram" },

  // 3. Vendas
  { id: "cart-large-2-line-duotone", componentName: "SolarCartLarge2LineDuotone", alias: "SolarSellerOrdersIcon", label: "Pedidos", section: "Vendas" },
  { id: "wallet-money-line-duotone", componentName: "SolarWalletMoneyLineDuotone", alias: "SolarSellerFinanceIcon", label: "Financeiro", section: "Vendas" },
  { id: "users-group-rounded-line-duotone", componentName: "SolarUsersGroupRoundedLineDuotone", alias: "SolarSellerCustomersIcon", label: "Clientes", section: "Vendas" },

  // 4. Conta
  { id: "card-2-line-duotone", componentName: "SolarCard2LineDuotone", alias: "SolarSellerGatewaysIcon", label: "Gateways", section: "Conta" },
  { id: "settings-line-duotone", componentName: "SolarSettingsLineDuotone", alias: "SolarSellerSettingsIcon", label: "Configurações", section: "Conta" },

  // 5. Rodapé e Ações
  { id: "arrow-left-line-duotone", componentName: "SolarArrowLeftLineDuotone", alias: "SolarSellerBackToAdminIcon", label: "Voltar ao Admin", section: "Rodapé" },
  { id: "logout-2-line-duotone", componentName: "SolarLogout2LineDuotone", alias: "SolarSellerLogoutIcon", label: "Sair da Conta", section: "Rodapé" },
  { id: "chart-2-line-duotone", componentName: "SolarChart2LineDuotone", alias: "SolarSellerSalesVolumeIcon", label: "Volume de Vendas", section: "Rodapé" },
];

// Validação estrita: se algum identificador não existir, falhar imediatamente
const missingIcons = [];
for (const item of SELLER_ICON_MAPPING) {
  const iconExists = iconsData.icons && (iconsData.icons[item.id] || (iconsData.aliases && iconsData.aliases[item.id]));
  if (!iconExists) {
    missingIcons.push(item.id);
  }
}

if (missingIcons.length > 0) {
  console.error("ERRO: Os seguintes identificadores Line Duotone não existem na coleção Solar:");
  for (const m of missingIcons) {
    console.error(`  - ${m}`);
  }
  process.exit(1);
}

const figmaUrl = infoData.author?.url || "https://www.figma.com/community/file/1166831539721848736";
const licenseTitle = infoData.license?.title || "CC BY 4.0";
const authorName = infoData.author?.name || "480 Design";

let code = `/**
 * Solar Icon Set (Line Duotone) by ${authorName}, ${licenseTitle}
 * Source: ${figmaUrl}
 * Auto-generated by scripts/generate-seller-solar-icons.mjs
 * Total extracted seller icons: ${SELLER_ICON_MAPPING.length}
 */

import React from "react";

export interface SolarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

`;

for (const item of SELLER_ICON_MAPPING) {
  const iconObj = iconsData.icons[item.id] || (iconsData.aliases && iconsData.aliases[item.id]);
  const width = iconObj.width || iconsData.width || 24;
  const height = iconObj.height || iconsData.height || 24;

  // Converter atributos para React JSX
  const jsxBody = iconObj.body
    .replace(/fill-rule=/g, "fillRule=")
    .replace(/clip-rule=/g, "clipRule=")
    .replace(/clip-path=/g, "clipPath=")
    .replace(/stroke-width=/g, "strokeWidth=")
    .replace(/stroke-linecap=/g, "strokeLinecap=")
    .replace(/stroke-linejoin=/g, "strokeLinejoin=")
    .replace(/stroke-miterlimit=/g, "strokeMiterlimit=")
    .replace(/stroke-dasharray=/g, "strokeDasharray=")
    .replace(/stroke-dashoffset=/g, "strokeDashoffset=");

  code += `/**
 * ${item.label} (${item.id})
 */
export function ${item.componentName}({
  size = 18,
  className,
  ...props
}: SolarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 ${width} ${height}"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      ${jsxBody}
    </svg>
  );
}

export const ${item.alias} = ${item.componentName};

`;
}

// Exportar dicionário com metadados para uso na página de preview
code += `export const SELLER_MENU_ICONS = [
${SELLER_ICON_MAPPING.map(
  (item) => `  {
    id: "${item.id}",
    name: "${item.componentName}",
    alias: "${item.alias}",
    label: "${item.label}",
    section: "${item.section}",
    Component: ${item.componentName},
  },`
).join("\n")}
] as const;
`;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, code, "utf-8");
console.log(`Sucesso: ${SELLER_ICON_MAPPING.length} ícones Solar Line Duotone gerados em ${outputFile}`);

