import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Combine static opaque pieces without dropping a vertex, triangle, UV or normal.
// Optical glass and the changing display stay independent.
export function batchStaticMeshes(root, { exclude, paperColors = false } = {}) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh === exclude || mesh.isSkinnedMesh || mesh.isInstancedMesh || !mesh.visible) return;
    const material = mesh.material, geometry = mesh.geometry;
    if (Array.isArray(material) || material.transparent || material.transmission > 0 || geometry.groups.length || Object.keys(geometry.morphAttributes).length) return;
    const paper = paperColors && material.name.startsWith('Papel • borda ') && !material.map && !geometry.attributes.color;
    // For paper, compare every exported material property except its name and color.
    const signature = material.toJSON();
    delete signature.metadata; delete signature.uuid; delete signature.name;
    if (paper) delete signature.color;
    const attributes = Object.entries(geometry.attributes).map(([name, a]) => [name, a.itemSize, a.normalized, a.array.constructor.name]).sort();
    const key = JSON.stringify([paper ? signature : material.uuid, attributes, !!geometry.index, mesh.renderOrder]);
    if (!buckets.has(key)) buckets.set(key, { paper, pieces: [] });
    buckets.get(key).pieces.push(mesh);
  });
  for (const { paper, pieces } of buckets.values()) {
    if (pieces.length < 2) continue;
    const geometries = pieces.map(mesh => {
      const geometry = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      if (paper) {
        const color = mesh.material.color;
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
      return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    let material = pieces[0].material;
    if (paper) { material = material.clone(); material.color.setRGB(1, 1, 1); material.vertexColors = true; }
    const batch = new THREE.Mesh(merged, material);
    batch.name = paper ? 'Original paper edges — batched colors' : pieces[0].name + '_batch';
    batch.renderOrder = pieces[0].renderOrder;
    pieces.forEach(mesh => mesh.removeFromParent());
    root.add(batch);
  }
}
