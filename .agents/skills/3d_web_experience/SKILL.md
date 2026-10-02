---
name: 3d_web_experience
description: Focuses on WebGL, Three.js, React Three Fiber, memory management, and crafting smooth 3D experiences on the web.
---

# 3D Web Experience Skill

Para lidar com 3D no navegador:
1. **Performance em 3D:** Mantenha o número de polígonos (draw calls) baixo. Reutilize geometrias e materiais sempre que possível (Instancing).
2. **Gerenciamento de Memória:** Sempre dê `dispose()` em geometrias, materiais e texturas que não são mais necessários para evitar vazamentos de memória (Memory Leaks).
3. **Otimização de Assets:** Comprima modelos 3D usando DRACO ou glTF e otimize texturas (resoluções baseadas em potências de 2).
4. **Iluminação e Sombras:** Bake de iluminação (Baked Shadows/Lights) sempre que o ambiente for estático para poupar processamento em tempo real.
5. **Progressive Enhancement:** Forneça fallbacks (carregamento suave, loaders, versão 2D) para dispositivos fracos.
