let selectedImages = [];
let collageCanvas = null;

// DOM elements
const imageInput = document.getElementById('imageInput');
const imageCount = document.getElementById('imageCount');
const previewSection = document.getElementById('previewSection');
const imagePreview = document.getElementById('imagePreview');
const frameWidthInput = document.getElementById('frameWidthInput');
const frameHeightInput = document.getElementById('frameHeightInput');
const dpiInput = document.getElementById('dpiInput');
const spacingInput = document.getElementById('spacingInput');
const bgColorInput = document.getElementById('bgColorInput');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const resultSection = document.getElementById('resultSection');
const canvasContainer = document.getElementById('canvasContainer');
const downloadBtn = document.getElementById('downloadBtn');
const errorMessage = document.getElementById('errorMessage');

// Convert inches to pixels
function inchesToPixels(inches, dpi) {
    return Math.round(inches * dpi);
}

// Handle image selection
imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    selectedImages.push({
                        file: file,
                        dataUrl: event.target.result,
                        width: img.width,
                        height: img.height,
                        aspectRatio: img.width / img.height
                    });
                    updatePreview();
                };
            };
            reader.readAsDataURL(file);
        }
    });
});

// Update preview section
function updatePreview() {
    imageCount.textContent = `${selectedImages.length} image(s) selected`;
    
    if (selectedImages.length > 0) {
        previewSection.classList.remove('hidden');
        imagePreview.innerHTML = '';
        
        selectedImages.forEach((imgData, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = imgData.dataUrl;
            img.alt = `Preview ${index + 1}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => removeImage(index);
            
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            imagePreview.appendChild(previewItem);
        });
    } else {
        previewSection.classList.add('hidden');
        resultSection.classList.add('hidden');
    }
    
    // Clear error when images change
    hideError();
}

// Remove image from selection
function removeImage(index) {
    selectedImages.splice(index, 1);
    updatePreview();
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Check if a rectangle can be placed at a given position
function canPlace(placedImages, x, y, width, height, spacing, frameWidth, frameHeight) {
    // Check frame bounds
    if (x + width + spacing > frameWidth || y + height + spacing > frameHeight) {
        return false;
    }
    
    // Check if overlaps with any placed image
    for (const img of placedImages) {
        const imgRight = img.x + img.width + spacing;
        const imgBottom = img.y + img.height + spacing;
        const newRight = x + width + spacing;
        const newBottom = y + height + spacing;
        
        // Check for overlap (with spacing)
        if (!(x >= imgRight || newRight <= img.x || y >= imgBottom || newBottom <= img.y)) {
            return false;
        }
    }
    
    return true;
}

// Find best position for an image using bottom-left fill algorithm
function findBestPosition(placedImages, imgWidth, imgHeight, spacing, frameWidth, frameHeight) {
    const positions = [];
    
    // Try placing at origin
    if (canPlace(placedImages, spacing, spacing, imgWidth, imgHeight, spacing, frameWidth, frameHeight)) {
        positions.push({ x: spacing, y: spacing });
    }
    
    // Try placing next to existing images (bottom-left fill strategy)
    for (const img of placedImages) {
        // Try to the right of this image (same y level)
        const x = img.x + img.width + spacing;
        const y = img.y;
        if (canPlace(placedImages, x, y, imgWidth, imgHeight, spacing, frameWidth, frameHeight)) {
            positions.push({ x, y });
        }
        
        // Try below this image (same x level)
        const x2 = img.x;
        const y2 = img.y + img.height + spacing;
        if (canPlace(placedImages, x2, y2, imgWidth, imgHeight, spacing, frameWidth, frameHeight)) {
            positions.push({ x: x2, y: y2 });
        }
        
        // Try at top-right corner of this image
        const x3 = img.x + img.width + spacing;
        const y3 = spacing;
        if (canPlace(placedImages, x3, y3, imgWidth, imgHeight, spacing, frameWidth, frameHeight)) {
            positions.push({ x: x3, y: y3 });
        }
    }
    
    if (positions.length === 0) return null;
    
    // Choose position that minimizes wasted space
    // Prefer positions that are lower (fill from bottom) and more to the left
    positions.sort((a, b) => {
        // First prioritize lower y (bottom-up filling)
        if (Math.abs(a.y - b.y) > 1) return a.y - b.y;
        // Then prioritize leftmost x
        return a.x - b.x;
    });
    
    return positions[0];
}

// Calculate optimal layout using bin-packing algorithm
function calculateFlexibleLayout(frameWidth, frameHeight, spacing, images) {
    if (images.length === 0) return null;
    
    // Sort images by area (largest first) for better packing
    const sortedImages = [...images].sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        return areaB - areaA; // Descending order
    });
    
    const placedImages = [];
    
    // Try to place each image
    for (const imgData of sortedImages) {
        const position = findBestPosition(placedImages, imgData.width, imgData.height, spacing, frameWidth, frameHeight);
        
        if (!position) {
            return null; // Can't fit this image
        }
        
        placedImages.push({
            ...imgData,
            x: position.x,
            y: position.y
        });
    }
    
    // Calculate total height used
    let maxY = 0;
    let maxX = 0;
    for (const img of placedImages) {
        maxY = Math.max(maxY, img.y + img.height + spacing);
        maxX = Math.max(maxX, img.x + img.width + spacing);
    }
    
    // Validate final layout
    if (maxX > frameWidth || maxY > frameHeight) {
        return null;
    }
    
    return {
        images: placedImages,
        totalHeight: maxY,
        totalWidth: maxX
    };
}

// Generate collage
generateBtn.addEventListener('click', () => {
    if (selectedImages.length === 0) {
        showError('Please select at least one image!');
        return;
    }
    
    const frameWidthInches = parseFloat(frameWidthInput.value) || 10;
    const frameHeightInches = parseFloat(frameHeightInput.value) || 8;
    const dpi = parseInt(dpiInput.value) || 300;
    const spacingInches = parseFloat(spacingInput.value) || 0.1;
    const bgColor = bgColorInput.value;
    
    if (frameWidthInches < 0.1 || frameHeightInches < 0.1) {
        showError('Frame size must be at least 0.1 inches in both dimensions!');
        return;
    }
    
    // Convert to pixels
    const frameWidth = inchesToPixels(frameWidthInches, dpi);
    const frameHeight = inchesToPixels(frameHeightInches, dpi);
    const spacing = inchesToPixels(spacingInches, dpi);
    
    // Calculate total area needed for all images at full size
    const totalImageWidth = selectedImages.reduce((sum, img) => sum + img.width, 0);
    const totalImageHeight = selectedImages.reduce((sum, img) => sum + img.height, 0);
    const maxImageWidth = Math.max(...selectedImages.map(img => img.width));
    const maxImageHeight = Math.max(...selectedImages.map(img => img.height));
    
    // Quick validation: if single largest image doesn't fit, show error
    if (maxImageWidth + 2 * spacing > frameWidth || maxImageHeight + 2 * spacing > frameHeight) {
        showError(`Frame size exceeded! Largest image (${Math.round(maxImageWidth/dpi*100)/100}" × ${Math.round(maxImageHeight/dpi*100)/100}") is too large for frame (${frameWidthInches}" × ${frameHeightInches}"). Please increase frame size or remove large images.`);
        return;
    }
    
    // Calculate flexible layout
    const layout = calculateFlexibleLayout(frameWidth, frameHeight, spacing, selectedImages);
    
    if (!layout) {
        // Estimate required dimensions for error message
        const estimatedWidth = totalImageWidth + (selectedImages.length + 1) * spacing;
        const estimatedHeight = totalImageHeight + (selectedImages.length + 1) * spacing;
        
        showError(`Frame size exceeded! Images require approximately ${Math.round(estimatedWidth/dpi*100)/100}" × ${Math.round(estimatedHeight/dpi*100)/100}" but frame is ${frameWidthInches}" × ${frameHeightInches}". Please increase frame dimensions or reduce spacing.`);
        return;
    }
    
    hideError();
    createCollage(frameWidth, frameHeight, spacing, bgColor, layout);
});

// Create collage canvas
function createCollage(frameWidth, frameHeight, spacing, bgColor, layout) {
    // Create canvas with exact frame size
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, frameWidth, frameHeight);
    
    let imagesLoaded = 0;
    const totalImages = layout.images.length;
    
    // Draw images using layout (images are already positioned)
    layout.images.forEach(imgData => {
        const img = new Image();
        img.src = imgData.dataUrl;
        
        img.onload = () => {
            // Draw image at full size at calculated position
            ctx.drawImage(img, imgData.x, imgData.y, img.width, img.height);
            
            imagesLoaded++;
            // Show result when all images are loaded
            if (imagesLoaded === totalImages) {
                showResult(canvas);
            }
        };
        
        img.onerror = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                showResult(canvas);
            }
        };
    });
    
    // Store canvas for download
    collageCanvas = canvas;
}

// Show result section
function showResult(canvas) {
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);
    resultSection.classList.remove('hidden');
    
    // Scroll to result
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Download collage
downloadBtn.addEventListener('click', () => {
    if (!collageCanvas) {
        showError('Please generate a collage first!');
        return;
    }
    
    collageCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collage-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 'image/png');
});

// Clear all
clearBtn.addEventListener('click', () => {
    selectedImages = [];
    imageInput.value = '';
    collageCanvas = null;
    updatePreview();
    canvasContainer.innerHTML = '';
    hideError();
});
