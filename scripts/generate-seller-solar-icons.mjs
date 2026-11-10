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

// Mapeamento dos ícones Solar Bold Duotone do Seller
export const SELLER_ICON_MAPPING = [
  // 1. Principal
  { id: "speedometer-middle-bold-duotone", componentName: "SolarDashboardBoldDuotone", alias: "SolarSellerDashboardIcon", label: "Dashboard", section: "Principal" },

  // 2. Bot Telegram
  { id: "bot-bold-duotone", componentName: "SolarBotBoldDuotone", alias: "SolarSellerBotIcon", label: "Configuração do Bot", section: "Bot Telegram" },
  { id: "magic-stick-2-bold-duotone", componentName: "SolarMagicStickBoldDuotone", alias: "SolarSellerWelcomeIcon", label: "Boas-vindas", section: "Bot Telegram" },
  { id: "gallery-wide-bold-duotone", componentName: "SolarGalleryWideBoldDuotone", alias: "SolarSellerBannersIcon", label: "Banners", section: "Bot Telegram" },
  { id: "box-bold-duotone", componentName: "SolarBoxBoldDuotone", alias: "SolarSellerProductsIcon", label: "Produtos", section: "Bot Telegram" },
  { id: "layers-minimalistic-bold-duotone", componentName: "SolarLayersMinimalisticBoldDuotone", alias: "SolarSellerCombosIcon", label: "Combos", section: "Bot Telegram" },
  { id: "clapperboard-play-bold-duotone", componentName: "SolarClapperboardPlayBoldDuotone", alias: "SolarSellerVideosIcon", label: "Biblioteca de Vídeos", section: "Bot Telegram" },
  { id: "slider-horizontal-bold-duotone", componentName: "SolarSliderHorizontalBoldDuotone", alias: "SolarSellerCarouselsIcon", label: "Carrosséis", section: "Bot Telegram" },
  { id: "tag-price-bold-duotone", componentName: "SolarTagPriceBoldDuotone", alias: "SolarSellerCategoriesIcon", label: "Categorias", section: "Bot Telegram" },
  { id: "videocamera-record-bold-duotone", componentName: "SolarVideocameraRecordBoldDuotone", alias: "SolarSellerClipsIcon", label: "Clips", section: "Bot Telegram" },
  { id: "bell-bold-duotone", componentName: "SolarBellBoldDuotone", alias: "SolarSellerNotificationsIcon", label: "Notificações", section: "Bot Telegram" },
  { id: "ticket-sale-bold-duotone", componentName: "SolarTicketSaleBoldDuotone", alias: "SolarSellerCouponsIcon", label: "Cupons", section: "Bot Telegram" },

  // 3. Vendas
  { id: "cart-large-2-bold-duotone", componentName: "SolarCartLarge2BoldDuotone", alias: "SolarSellerOrdersIcon", label: "Pedidos", section: "Vendas" },
  { id: "wallet-money-bold-duotone", componentName: "SolarWalletMoneyBoldDuotone", alias: "SolarSellerFinanceIcon", label: "Financeiro", section: "Vendas" },
  { id: "users-group-rounded-bold-duotone", componentName: "SolarUsersGroupRoundedBoldDuotone", alias: "SolarSellerCustomersIcon", label: "Clientes", section: "Vendas" },

  // 4. Conta
  { id: "card-2-bold-duotone", componentName: "SolarCard2BoldDuotone", alias: "SolarSellerGatewaysIcon", label: "Gateways", section: "Conta" },
  { id: "settings-bold-duotone", componentName: "SolarSettingsBoldDuotone", alias: "SolarSellerSettingsIcon", label: "Configurações", section: "Conta" },

  // 5. Rodapé e Ações
  { id: "arrow-left-bold-duotone", componentName: "SolarArrowLeftBoldDuotone", alias: "SolarSellerBackToAdminIcon", label: "Voltar ao Admin", section: "Rodapé" },
  { id: "logout-2-bold-duotone", componentName: "SolarLogout2BoldDuotone", alias: "SolarSellerLogoutIcon", label: "Sair da Conta", section: "Rodapé" },
  { id: "chart-2-bold-duotone", componentName: "SolarChart2BoldDuotone", alias: "SolarSellerSalesVolumeIcon", label: "Volume de Vendas", section: "Rodapé" },
];

// Mapeamento dos ícones adicionais Solar Bold Duotone para o Header e Navegação do Bot
export const BOT_ICON_MAPPING = [
  { id: "widget-4-bold-duotone", componentName: "SolarWidget4BoldDuotone", alias: "SolarSellerOverviewIcon", label: "Visão Geral do Bot", section: "Bot Controls" },
  { id: "chart-square-bold-duotone", componentName: "SolarChartSquareBoldDuotone", alias: "SolarSellerChartSquareIcon", label: "Gráfico em Quadrado", section: "Bot Controls" },
  { id: "chat-round-dots-bold-duotone", componentName: "SolarChatRoundDotsBoldDuotone", alias: "SolarSellerConversasIcon", label: "Conversas do Bot", section: "Bot Controls" },
  { id: "filter-bold-duotone", componentName: "SolarFilterBoldDuotone", alias: "SolarSellerFilterIcon", label: "Filtros do Bot", section: "Bot Controls" },
  { id: "square-share-line-bold-duotone", componentName: "SolarSquareShareLineBoldDuotone", alias: "SolarSellerExternalLinkIcon", label: "Abrir Externamente", section: "Bot Controls" },
  { id: "plain-2-bold-duotone", componentName: "SolarPlain2BoldDuotone", alias: "SolarSellerTelegramIcon", label: "Abrir no Telegram", section: "Bot Controls" },
  { id: "menu-dots-vertical-bold-duotone", componentName: "SolarMenuDotsVerticalBoldDuotone", alias: "SolarSellerMenuDotsVerticalIcon", label: "Menu Mais Opções", section: "Bot Controls" },
];

const ALL_MAPPINGS = [...SELLER_ICON_MAPPING, ...BOT_ICON_MAPPING];

// Validação estrita: se algum identificador não existir, falhar imediatamente
const missingIcons = [];
for (const item of ALL_MAPPINGS) {
  const iconExists = iconsData.icons && (iconsData.icons[item.id] || (iconsData.aliases && iconsData.aliases[item.id]));
  if (!iconExists) {
    missingIcons.push(item.id);
  }
}

if (missingIcons.length > 0) {
  console.error("ERRO: Os seguintes identificadores Bold Duotone não existem na coleção Solar:");
  for (const m of missingIcons) {
    console.error(`  - ${m}`);
  }
  process.exit(1);
}

const figmaUrl = infoData.author?.url || "https://www.figma.com/community/file/1166831539721848736";
const licenseTitle = infoData.license?.title || "CC BY 4.0";
const authorName = infoData.author?.name || "480 Design";

let code = `/**
 * Solar Icon Set (Bold Duotone) by ${authorName}, ${licenseTitle}
 * Source: ${figmaUrl}
 * Auto-generated by scripts/generate-seller-solar-icons.mjs
 * Total extracted seller icons: ${ALL_MAPPINGS.length}
 */

import React from "react";

export interface SolarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

`;

for (const item of ALL_MAPPINGS) {
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

// Exportar dicionário com metadados para uso na página de preview (preservando os 20 principais da sidebar)
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

export const BOT_HEADER_AND_NAV_ICONS = [
${BOT_ICON_MAPPING.map(
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
console.log(`Sucesso: ${SELLER_ICON_MAPPING.length} ícones Solar Bold Duotone gerados em ${outputFile}`);

