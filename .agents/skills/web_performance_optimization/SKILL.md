---
name: web_performance_optimization
description: Focuses on maximizing web performance, reducing load times, and optimizing assets and JavaScript payloads.
---

# Web Performance Optimization Skill

Para otimizar o carregamento e a execução:
1. **Otimização de Imagens:** Use formatos modernos (WebP, AVIF), tamanhos responsivos (`srcset`) e Lazy Loading (`loading="lazy"`) em imagens abaixo da dobra.
2. **Minificação e Compressão:** Garanta que CSS, JS e HTML estejam minificados e servidos com compressão Brotli ou Gzip.
3. **Redução de Payload JS:** Aplique Tree Shaking rigoroso e Code Splitting. Carregue sob demanda o que não é essencial no momento (Dynamic Imports).
4. **Render Blocking:** Adie o carregamento de scripts não críticos (`defer` ou `async`) e in-line CSS crítico na tag `<head>`.
5. **Core Web Vitals:** Otimize ativamente LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift) e INP (Interaction to Next Paint).
