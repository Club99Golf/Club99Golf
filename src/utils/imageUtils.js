export function compressImage(dataUrl, maxSize = 200, maxBytes = 200000) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale so longest side = maxSize, never upscale
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.85;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > maxBytes && quality > 0.2) {
        quality = Math.round((quality - 0.1) * 10) / 10;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.src = dataUrl;
  });
}
