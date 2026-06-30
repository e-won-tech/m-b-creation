(function () {
  window.ShopServices = window.ShopServices || {};

  function getCloudinaryConfig() {
    const config = window.SHOP_CONFIG || {};
    return config.cloudinary || {};
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
      img.src = src;
    });
  }

  // Convert to WebP (and downscale very large images) in the browser before upload,
  // so Cloudinary stores a smaller file and the storefront loads faster.
  async function convertToWebp(file, { maxDimension = 1600, quality = 0.82 } = {}) {
    if (!file?.type?.startsWith("image/")) return file;
    if (file.type === "image/webp") return file;
    if (typeof document === "undefined" || !document.createElement) return file;

    try {
      const img = await loadImage(await readFileAsDataUrl(file));
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (maxDimension && Math.max(width, height) > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) return file; // browser could not encode WebP — keep original

      const name = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
      return new File([blob], name, { type: "image/webp" });
    } catch (error) {
      console.warn("แปลง WebP ไม่สำเร็จ ใช้ไฟล์เดิมแทน", error);
      return file;
    }
  }

  async function uploadToCloudinary(file, folder) {
    const config = getCloudinaryConfig();
    if (!config.cloudName || !config.unsignedUploadPreset) throw new Error("ยังไม่ได้ตั้งค่า Cloudinary unsigned upload preset");
    if (!file?.type?.startsWith("image/")) throw new Error("รูปสินค้าต้องเป็นไฟล์รูปภาพ");

    const optimized = await convertToWebp(file);

    const form = new FormData();
    form.append("file", optimized);
    form.append("upload_preset", config.unsignedUploadPreset);
    if (folder) form.append("folder", folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
      method: "POST",
      body: form
    });

    if (!response.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
    const data = await response.json();
    return {
      url: data.secure_url,
      publicId: data.public_id
    };
  }

  async function uploadProductImage(file, shopId) {
    return uploadToCloudinary(file, `shops/${shopId}/products`);
  }

  async function uploadShopLogo(file, shopId) {
    return uploadToCloudinary(file, `shops/${shopId}/logo`);
  }

  async function uploadPaymentImage(file, shopId) {
    return uploadToCloudinary(file, `shops/${shopId}/payment`);
  }

  async function deleteCloudinaryImage(publicId) {
    console.warn("Cloudinary delete must run on a trusted server. Public id:", publicId);
    throw new Error("ลบรูป Cloudinary ต้องทำผ่าน server เท่านั้น");
  }

  window.ShopServices.uploadService = {
    uploadProductImage,
    uploadShopLogo,
    uploadPaymentImage,
    deleteCloudinaryImage
  };
})();
