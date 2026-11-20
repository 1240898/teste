const align4 = (buffer, fill = 0) =>
  buffer.length % 4
    ? Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4), fill)])
    : buffer;

/**
 * Writes a GLB with one named node per part. A child can name an earlier part
 * as its parent and provide a local translation for its pivot. Textured
 * recipes embed existing PNGs, once per file. Factor-only equipment recipes
 * still use their material override from the layout.
 */
export function buildGlb({ name, parts, materials }, readTexture) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;
  const addView = (data, target) => {
    const padded = align4(data);
    bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: data.length,
      ...(target ? { target } : {}),
    });
    chunks.push(padded);
    offset += padded.length;
    return bufferViews.length - 1;
  };

  const images = [];
  const textures = [];
  const textureIndices = new Map();
  const textureInfo = (file) => {
    if (!textureIndices.has(file)) {
      const index = images.length;
      images.push({
        bufferView: addView(readTexture(file)),
        mimeType: 'image/png',
      });
      textures.push({ source: index });
      textureIndices.set(file, index);
    }
    return { index: textureIndices.get(file) };
  };

  const materialNames = Object.keys(materials);
  const gltfMaterials = materialNames.map((key) => {
    const { colour, metallic, roughness, colourMap, normalMap } =
      materials[key];
    return {
      name: key,
      pbrMetallicRoughness: {
        baseColorFactor: [...colour.map((value) => value / 255), 1],
        metallicFactor: metallic,
        roughnessFactor: roughness,
        ...(colourMap ? { baseColorTexture: textureInfo(colourMap) } : {}),
      },
      ...(normalMap ? { normalTexture: textureInfo(normalMap) } : {}),
    };
  });

  const meshes = parts.map(({ name: partName, mesh, material }) => {
    const materialIndex = materialNames.indexOf(material);
    if (materialIndex < 0) throw new Error(`Unknown material ${material}`);
    const { min, max } = mesh.bounds();
    const count = mesh.positions.length / 3;
    const view = (array, target) => addView(Buffer.from(array.buffer), target);
    accessors.push(
      {
        bufferView: view(new Float32Array(mesh.positions), 34962),
        componentType: 5126,
        count,
        type: 'VEC3',
        min,
        max,
      },
      {
        bufferView: view(new Float32Array(mesh.normals), 34962),
        componentType: 5126,
        count,
        type: 'VEC3',
      },
      {
        bufferView: view(new Float32Array(mesh.uvs), 34962),
        componentType: 5126,
        count,
        type: 'VEC2',
      },
      {
        bufferView: view(new Uint16Array(mesh.indices), 34963),
        componentType: 5123,
        count: mesh.indices.length,
        type: 'SCALAR',
      },
    );
    const first = accessors.length - 4;
    return {
      name: partName,
      primitives: [
        {
          attributes: {
            POSITION: first,
            NORMAL: first + 1,
            TEXCOORD_0: first + 2,
          },
          indices: first + 3,
          material: materialIndex,
        },
      ],
    };
  });

  const nodes = [];
  const sceneNodes = [];
  const nodeIndices = new Map();
  for (const { name: partName, parent, translation } of parts) {
    if (nodeIndices.has(partName))
      throw new Error(`Duplicate model part ${partName}`);
    const index = nodes.length;
    if (parent === undefined) {
      sceneNodes.push(index);
    } else {
      const parentNode = nodes[nodeIndices.get(parent)];
      if (!parentNode)
        throw new Error(`Unknown parent ${parent} for ${partName}`);
      (parentNode.children ??= []).push(index);
    }
    nodes.push({
      name: partName,
      mesh: index,
      ...(translation ? { translation } : {}),
    });
    nodeIndices.set(partName, index);
  }

  const binary = Buffer.concat(chunks);
  const gltf = {
    asset: {
      version: '2.0',
      generator: images.length
        ? 'LaPrizza kitchen models (VIS03)'
        : 'LaPrizza kitchen models (VIS02)',
    },
    scene: 0,
    scenes: [{ name, nodes: sceneNodes }],
    nodes,
    meshes,
    materials: gltfMaterials,
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors,
    ...(images.length ? { images, textures } : {}),
  };
  const json = align4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, binary]);
}
