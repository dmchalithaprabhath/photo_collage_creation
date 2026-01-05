let selectedImages = [];
let frames = []; // Array to store all frames
let activeFrameIndex = 0;

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
const transparentBgInput = document.getElementById('transparentBgInput');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const resultSection = document.getElementById('resultSection');
const tabsContainer = document.getElementById('tabsContainer');
const framesContainer = document.getElementById('framesContainer');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const errorMessage = document.getElementById('errorMessage');

// Convert inches to pixels
function inchesToPixels(inches, dpi) {
    return Math.round(inches * dpi);
}

// Handle transparent background checkbox
transparentBgInput.addEventListener('change', () => {
    bgColorInput.disabled = transparentBgInput.checked;
    if (transparentBgInput.checked) {
        bgColorInput.style.opacity = '0.5';
    } else {
        bgColorInput.style.opacity = '1';
    }
});

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
// Tries both original and rotated (90°) orientations
function findBestPosition(placedImages, imgWidth, imgHeight, spacing, frameWidth, frameHeight) {
    const positions = [];
    
    // Helper function to try placing at various positions
    const tryPlace = (width, height, rotated = false) => {
        // Try placing at origin
        if (canPlace(placedImages, spacing, spacing, width, height, spacing, frameWidth, frameHeight)) {
            positions.push({ x: spacing, y: spacing, width, height, rotated });
        }
        
        // Try placing next to existing images (bottom-left fill strategy)
        for (const img of placedImages) {
            // Try to the right of this image (same y level)
            const x = img.x + img.width + spacing;
            const y = img.y;
            if (canPlace(placedImages, x, y, width, height, spacing, frameWidth, frameHeight)) {
                positions.push({ x, y, width, height, rotated });
            }
            
            // Try below this image (same x level)
            const x2 = img.x;
            const y2 = img.y + img.height + spacing;
            if (canPlace(placedImages, x2, y2, width, height, spacing, frameWidth, frameHeight)) {
                positions.push({ x: x2, y: y2, width, height, rotated });
            }
            
            // Try at top-right corner of this image
            const x3 = img.x + img.width + spacing;
            const y3 = spacing;
            if (canPlace(placedImages, x3, y3, width, height, spacing, frameWidth, frameHeight)) {
                positions.push({ x: x3, y: y3, width, height, rotated });
            }
        }
    };
    
    // Try original orientation
    tryPlace(imgWidth, imgHeight, false);
    
    // Try rotated orientation (90 degrees - swap width and height)
    tryPlace(imgHeight, imgWidth, true);
    
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

// Calculate optimal layout for a frame using bin-packing algorithm
function calculateFrameLayout(frameWidth, frameHeight, spacing, images) {
    if (images.length === 0) return { images: [], remainingImages: [] };
    
    // Sort images by area (largest first) for better packing
    const sortedImages = [...images].sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        return areaB - areaA; // Descending order
    });
    
    const placedImages = [];
    const remainingImages = [];
    
    // Try to place each image
    for (const imgData of sortedImages) {
        const position = findBestPosition(placedImages, imgData.width, imgData.height, spacing, frameWidth, frameHeight);
        
        if (!position) {
            // Can't fit this image in current frame
            remainingImages.push(imgData);
        } else {
            placedImages.push({
                ...imgData,
                x: position.x,
                y: position.y,
                displayWidth: position.width,
                displayHeight: position.height,
                rotated: position.rotated
            });
        }
    }
    
    // Calculate total height used
    let maxY = 0;
    let maxX = 0;
    for (const img of placedImages) {
        maxY = Math.max(maxY, img.y + img.displayHeight + spacing);
        maxX = Math.max(maxX, img.x + img.displayWidth + spacing);
    }
    
    // Validate final layout
    if (maxX > frameWidth || maxY > frameHeight) {
        // If validation fails, return what we have and mark remaining
        return { images: placedImages, remainingImages: remainingImages };
    }
    
    return {
        images: placedImages,
        remainingImages: remainingImages,
        totalHeight: maxY,
        totalWidth: maxX
    };
}

// Create multiple frames
function createMultipleFrames(frameWidth, frameHeight, spacing, bgColor, images, dpi) {
    frames = [];
    let remainingImages = [...images];
    let frameIndex = 0;
    
    // Check if any image is too large for a single frame (try both orientations)
    let maxRequiredWidth = 0;
    let maxRequiredHeight = 0;
    let imageTooLarge = false;
    
    for (const img of images) {
        // Try original orientation
        const width1 = img.width + 2 * spacing;
        const height1 = img.height + 2 * spacing;
        // Try rotated orientation
        const width2 = img.height + 2 * spacing;
        const height2 = img.width + 2 * spacing;
        
        // Check if image fits in at least one orientation
        const fitsOriginal = width1 <= frameWidth && height1 <= frameHeight;
        const fitsRotated = width2 <= frameWidth && height2 <= frameHeight;
        
        if (!fitsOriginal && !fitsRotated) {
            // Image doesn't fit in either orientation
            imageTooLarge = true;
            maxRequiredWidth = Math.max(maxRequiredWidth, width1, width2);
            maxRequiredHeight = Math.max(maxRequiredHeight, height1, height2);
        }
    }
    
    if (imageTooLarge) {
        const requiredWidthInches = Math.round(maxRequiredWidth / dpi * 100) / 100;
        const requiredHeightInches = Math.round(maxRequiredHeight / dpi * 100) / 100;
        showError(`Some images are too large for the frame size. Largest image requires ${requiredWidthInches}" × ${requiredHeightInches}" but frame is ${frameWidthInput.value}" × ${frameHeightInput.value}".`);
        return;
    }
    
    // Create frames until all images are placed
    while (remainingImages.length > 0) {
        const layout = calculateFrameLayout(frameWidth, frameHeight, spacing, remainingImages);
        
        if (layout.images.length === 0) {
            // No images could be placed - this shouldn't happen if validation above worked
            showError('Unable to place remaining images. Please check frame size.');
            break;
        }
        
        // Create canvas for this frame
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        const ctx = canvas.getContext('2d');
        
        // Fill background only if not transparent
        if (!transparentBgInput.checked) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, frameWidth, frameHeight);
        }
        
        frames.push({
            index: frameIndex,
            canvas: canvas,
            ctx: ctx,
            layout: layout,
            imagesLoaded: 0,
            totalImages: layout.images.length
        });
        
        // Update remaining images
        remainingImages = layout.remainingImages;
        frameIndex++;
    }
    
    // Draw all frames
    frames.forEach((frame, index) => {
        drawFrame(frame, index);
    });
}

// Draw a single frame
function drawFrame(frame, frameIndex) {
    frame.layout.images.forEach(imgData => {
        const img = new Image();
        img.src = imgData.dataUrl;
        
        img.onload = () => {
            const ctx = frame.ctx;
            
            if (imgData.rotated) {
                // Save context state
                ctx.save();
                
                // Calculate center point of where image will be drawn
                const centerX = imgData.x + imgData.displayWidth / 2;
                const centerY = imgData.y + imgData.displayHeight / 2;
                
                // Translate to center, rotate 90 degrees clockwise
                ctx.translate(centerX, centerY);
                ctx.rotate(Math.PI / 2); // 90 degrees clockwise
                
                // Draw image centered at origin (after rotation)
                // Since we rotated, we draw with swapped dimensions
                ctx.drawImage(img, -imgData.displayHeight / 2, -imgData.displayWidth / 2, imgData.displayHeight, imgData.displayWidth);
                
                // Restore context state
                ctx.restore();
            } else {
                // Draw image normally at full size
                ctx.drawImage(img, imgData.x, imgData.y, imgData.displayWidth, imgData.displayHeight);
            }
            
            frame.imagesLoaded++;
            // Show result when all images in this frame are loaded
            if (frame.imagesLoaded === frame.totalImages) {
                if (frameIndex === 0) {
                    // Show UI when first frame is ready
                    showResults();
                }
            }
        };
        
        img.onerror = () => {
            frame.imagesLoaded++;
            if (frame.imagesLoaded === frame.totalImages && frameIndex === 0) {
                showResults();
            }
        };
    });
}

// Show results with tabs
function showResults() {
    // Clear previous results
    tabsContainer.innerHTML = '';
    framesContainer.innerHTML = '';
    
    // Create tabs
    frames.forEach((frame, index) => {
        const tab = document.createElement('button');
        tab.className = `tab-btn ${index === 0 ? 'active' : ''}`;
        tab.textContent = `Frame ${index + 1} (${frame.layout.images.length} images)`;
        tab.onclick = () => switchFrame(index);
        tabsContainer.appendChild(tab);
    });
    
    // Show first frame
    switchFrame(0);
    resultSection.classList.remove('hidden');
    
    // Scroll to result
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Switch between frames
function switchFrame(index) {
    activeFrameIndex = index;
    
    // Update tab buttons
    const tabButtons = tabsContainer.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show selected frame
    framesContainer.innerHTML = '';
    const frameDiv = document.createElement('div');
    frameDiv.className = 'frame-display';
    frameDiv.appendChild(frames[index].canvas);
    framesContainer.appendChild(frameDiv);
}

// Generate collage
generateBtn.addEventListener('click', () => {
    if (selectedImages.length === 0) {
        showError('Please select at least one image!');
        return;
    }
    
    const frameWidthInches = parseFloat(frameWidthInput.value) || 16.5;
    const frameHeightInches = parseFloat(frameHeightInput.value) || 39;
    const dpi = parseInt(dpiInput.value) || 96;
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
    
    hideError();
    createMultipleFrames(frameWidth, frameHeight, spacing, bgColor, selectedImages, dpi);
});

// Download all frames
downloadAllBtn.addEventListener('click', () => {
    if (frames.length === 0) {
        showError('Please generate frames first!');
        return;
    }
    
    frames.forEach((frame, index) => {
        setTimeout(() => {
            frame.canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `frame-${index + 1}-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');
        }, index * 200); // Stagger downloads
    });
});

// Clear all
clearBtn.addEventListener('click', () => {
    selectedImages = [];
    frames = [];
    imageInput.value = '';
    updatePreview();
    tabsContainer.innerHTML = '';
    framesContainer.innerHTML = '';
    hideError();
});
