    /* ====================================================
      Modal de edición (se usará para aplicar recorte y filtro)
    ==================================================== */
    let cropper = null;
    let editedImageData = null; // Se almacenará la imagen editada

    function openEditor(dataURL) {
      const editorModal = document.getElementById('editorModal');
      const editorImage = document.getElementById('editorImage');
      editorImage.src = dataURL;
      if(cropper) { cropper.destroy(); }
      cropper = new Cropper(editorImage, {
        viewMode: 1,
        movable: true,
        zoomable: true,
        scalable: true,
        cropBoxResizable: true,
      });
      editorModal.style.display = 'block';
    }
  
    function closeEditor() {
      const editorModal = document.getElementById('editorModal');
      editorModal.style.display = 'none';
      if(cropper) { cropper.destroy(); cropper = null; }
    }

    document.getElementById('cancelEdit').addEventListener('click', closeEditor);

    // Al pulsar "Descargar con filtro escáner" se toma el recorte, se aplica el filtro y se descarga
    document.getElementById('applyEdit').addEventListener('click', () => {
      if (!cropper) return;
      const croppedCanvas = cropper.getCroppedCanvas();
      // Aplica el filtro de escáner al canvas recortado
      applyScanFilterToCanvas(croppedCanvas, croppedCanvas.width, croppedCanvas.height);
      const editedData = croppedCanvas.toDataURL('image/jpeg', 0.85);
      // Descarga según el tipo de archivo editado
      if(editFileType === "image") {
        const link = document.createElement('a');
        link.href = editedData;
        link.download = 'imagen_editada.jpg';
        link.click();
      } else if(editFileType === "pdf") {
        const { jsPDF } = window.jspdf;
        const img = new Image();
        img.onload = function() {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [img.width, img.height]
          });
          pdf.addImage(editedData, 'JPEG', 0, 0, img.width, img.height);
          pdf.save('documento_editado.pdf');
        };
        img.src = editedData;
      }
      closeEditor();
    });

    /* ====================================================
      Sección: Extraer imágenes de PDF (ya existente)
    ==================================================== */
    const dropZonePdf = document.getElementById('dropZonePdf');
    const pdfCanvas = document.getElementById('pdfCanvas');
    const ctx = pdfCanvas.getContext('2d');
    const downloadBtn = document.getElementById('downloadAllImages');
    const downloadBtnBN = document.getElementById('downloadAllImagesBN');
    const cancelExtractButton = document.getElementById('cancelExtract');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    // const editExtractedButton = document.getElementById('editExtracted');

    dropZonePdf.addEventListener('dragover', (e) => { e.preventDefault(); dropZonePdf.classList.add('dragover'); });
    dropZonePdf.addEventListener('dragleave', () => { dropZonePdf.classList.remove('dragover'); });
    dropZonePdf.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZonePdf.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if(files.length > 0 && files[0].type === 'application/pdf') {
        const file = files[0];
        dropZonePdf.textContent = `Archivo cargado: ${file.name}`;
        cancelExtractButton.style.display = 'inline-block';
        extractImagesFromPdf(file);
      } else { alert('Por favor, arrastra un archivo válido (PDF).'); }
    });
    dropZonePdf.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.click();
      input.addEventListener('change', () => {
        const file = input.files[0];
        if(file && file.type === 'application/pdf') {
          dropZonePdf.textContent = `Archivo cargado: ${file.name}`;
          cancelExtractButton.style.display = 'inline-block';
          extractImagesFromPdf(file);
        } else { alert('Por favor, selecciona un archivo válido (PDF).'); }
      });
    });

    async function extractImagesFromPdf(pdfFile) {
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      const fileReader = new FileReader();
      fileReader.onload = async function(e) {
        const pdfData = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const baseName = pdfFile.name.replace(/\.[^/.]+$/, "");
        const extractedImages = [];
        for(let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          pdfCanvas.width = viewport.width;
          pdfCanvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          const imageData = pdfCanvas.toDataURL('image/png');
          extractedImages.push({ data: imageData, filename: `${baseName}-pagina-${i}.png` });
          progressBar.style.width = ((i / pdf.numPages)*100) + '%';
        }
        setTimeout(() => { progressContainer.style.display = 'none'; }, 500);
        downloadBtn.style.display = 'inline-block';
        downloadBtnBN.style.display = 'inline-block';
        // editExtractedButton.style.display = 'inline-block';
        downloadBtn.onclick = async function() {
          const zip = new JSZip();
          extractedImages.forEach(imgObj => {
            const base64 = imgObj.data.split(',')[1];
            zip.file(imgObj.filename, base64, { base64: true });
          });
          const content = await zip.generateAsync({ type: "blob" });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = `${baseName}_imagenes.zip`;
          link.click();
          downloadBtn.style.display = 'none';
          downloadBtnBN.style.display = 'none';
          // editExtractedButton.style.display = 'none';
          cancelExtractButton.style.display = 'none';
          dropZonePdf.textContent = 'Arrastra y suelta un archivo PDF aquí o haz clic para seleccionarlo';
        };
        downloadBtnBN.onclick = async function() {
          const zip = new JSZip();
          for(const imgObj of extractedImages) {
            const grayDataURL = await convertDataURLWithScanFilter(imgObj.data);
            zip.file(imgObj.filename, grayDataURL.split(',')[1], { base64: true });
          }
          const content = await zip.generateAsync({ type: "blob" });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = `${baseName}_imagenes_scan.zip`;
          link.click();
          downloadBtn.style.display = 'none';
          downloadBtnBN.style.display = 'none';
          // editExtractedButton.style.display = 'none';
          cancelExtractButton.style.display = 'none';
          dropZonePdf.textContent = 'Arrastra y suelta un archivo PDF aquí o haz clic para seleccionarlo';
        };
        // alert('Las imágenes han sido extraídas. Puedes descargarlas (color o con filtro escáner), editar o cancelar.');
      };
      fileReader.readAsArrayBuffer(pdfFile);
    }

    cancelExtractButton.addEventListener('click', () => {
      dropZonePdf.textContent = 'Arrastra y suelta un archivo PDF aquí o haz clic para seleccionarlo';
      downloadBtn.style.display = 'none';
      downloadBtnBN.style.display = 'none';
      // editExtractedButton.style.display = 'none';
      cancelExtractButton.style.display = 'none';
      progressContainer.style.display = 'none';
    });

    function applyScanFilterToCanvas(canvas, width, height) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const contrast = 2.6;
      const brightness = 10;
      for(let i = 0; i < data.length; i += 4) {
        let gray = 0.3 * data[i] + 0.59 * data[i+1] + 0.11 * data[i+2];
        gray = contrast * (gray - 128) + 128 + brightness;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = data[i+1] = data[i+2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function convertDataURLWithScanFilter(dataURL) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const contrast = 2.6;
          const brightness = 10;
          for(let i = 0; i < data.length; i += 4) {
            let gray = 0.3 * data[i] + 0.59 * data[i+1] + 0.11 * data[i+2];
            gray = contrast * (gray - 128) + 128 + brightness;
            gray = Math.max(0, Math.min(255, gray));
            data[i] = data[i+1] = data[i+2] = gray;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = dataURL;
      });
    }

    /* ====================================================
      Sección: Convertir imágenes a PDF (ya existente)
    ==================================================== */
    const dropZoneConv = document.getElementById('dropZone');
    const generatePdfButton = document.getElementById('generatePdf');
    const generatePdfBNButton = document.getElementById('generatePdfBN');
    const cancelPdfButton = document.getElementById('cancelPdf');
    const editDocumentButton = document.getElementById('editDocument');
    let selectedImages = [];

    dropZoneConv.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneConv.classList.add('dragover'); });
    dropZoneConv.addEventListener('dragleave', () => { dropZoneConv.classList.remove('dragover'); });
    dropZoneConv.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZoneConv.classList.remove('dragover');
      processImages(e.dataTransfer.files);
    });
    dropZoneConv.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg';
      input.multiple = true;
      input.click();
      input.addEventListener('change', () => processImages(input.files));
    });

    function processImages(files) {
      selectedImages = Array.from(files).filter(file => file.type === 'image/png' || file.type === 'image/jpeg');
      if(selectedImages.length > 0) {
        dropZoneConv.textContent = `${selectedImages.length} imágenes cargadas`;
        generatePdfButton.disabled = false;
        generatePdfBNButton.disabled = false;
        cancelPdfButton.style.display = 'inline-block';
        editDocumentButton.style.display = 'inline-block';
      } else {
        alert('Por favor, selecciona imágenes válidas (PNG o JPEG).');
      }
    }

    generatePdfButton.addEventListener('click', () => {
      if(selectedImages.length === 0) return;
      const { jsPDF } = window.jspdf;
      let firstImage = true;
      let pdf;
      let processed = 0;
      selectedImages.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(event) {
          const img = new Image();
          img.onload = function() {
            const scaleFactor = 0.9;
            const newWidth = img.width * scaleFactor;
            const newHeight = img.height * scaleFactor;
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            const compressedData = canvas.toDataURL('image/jpeg', 0.85);
            if(firstImage) {
              pdf = new jsPDF({
                orientation: newWidth > newHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [newWidth, newHeight],
              });
              firstImage = false;
            } else {
              pdf.addPage([newWidth, newHeight]);
            }
            pdf.addImage(compressedData, 'JPEG', 0, 0, newWidth, newHeight);
            processed++;
            if(processed === selectedImages.length) {
              pdf.save('imagenes_convertidas.pdf');
              selectedImages = [];
              dropZoneConv.textContent = 'Arrastra y suelta imágenes aquí o haz clic para seleccionarlas';
              generatePdfButton.disabled = true;
              generatePdfBNButton.disabled = true;
              cancelPdfButton.style.display = 'none';
              editDocumentButton.style.display = 'none';
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    generatePdfBNButton.addEventListener('click', () => {
      if(selectedImages.length === 0) return;
      const { jsPDF } = window.jspdf;
      let firstImage = true;
      let pdf;
      let processed = 0;
      selectedImages.forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(event) {
          const img = new Image();
          img.onload = function() {
            const scaleFactor = 0.9;
            const newWidth = img.width * scaleFactor;
            const newHeight = img.height * scaleFactor;
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            // Aplicar filtro de escaneo
            applyScanFilterToCanvas(canvas, newWidth, newHeight);
            const compressedData = canvas.toDataURL('image/jpeg', 0.85);
            if(firstImage) {
              pdf = new jsPDF({
                orientation: newWidth > newHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [newWidth, newHeight],
              });
              firstImage = false;
            } else {
              pdf.addPage([newWidth, newHeight]);
            }
            pdf.addImage(compressedData, 'JPEG', 0, 0, newWidth, newHeight);
            processed++;
            if(processed === selectedImages.length) {
              pdf.save('imagenes_convertidas_scan.pdf');
              selectedImages = [];
              dropZoneConv.textContent = 'Arrastra y suelta imágenes aquí o haz clic para seleccionarlas';
              generatePdfButton.disabled = true;
              generatePdfBNButton.disabled = true;
              cancelPdfButton.style.display = 'none';
              editDocumentButton.style.display = 'none';
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    cancelPdfButton.addEventListener('click', () => {
      selectedImages = [];
      dropZoneConv.textContent = 'Arrastra y suelta imágenes aquí o haz clic para seleccionarlas';
      generatePdfButton.disabled = true;
      generatePdfBNButton.disabled = true;
      cancelPdfButton.style.display = 'none';
      editDocumentButton.style.display = 'none';
    });

    editDocumentButton.addEventListener('click', () => {
      if(selectedImages.length === 0) return;
      const reader = new FileReader();
      reader.onload = function(event) {
        openEditor(event.target.result);
      };
      reader.readAsDataURL(selectedImages[0]);
    });

    /* ====================================================
      SECCIÓN: Editar imágenes o documentos sin conversión
    ==================================================== */
    const editDropZone = document.getElementById('editDropZone');
    const editPreviewContainer = document.getElementById('editPreviewContainer');
    const editPreview = document.getElementById('editPreview');
    const editPdfCanvas = document.getElementById('editPdfCanvas');
    const openEditorButton = document.getElementById('openEditor');
    const downloadEditedButton = document.getElementById('downloadEdited');
    const cancelEditSectionButton = document.getElementById('cancelEditSection');

    let editFileType = ""; // "image" o "pdf"
    let editOriginalData = "";
    let editOriginalMime = "";

    editDropZone.addEventListener('dragover', (e) => { e.preventDefault(); editDropZone.classList.add('dragover'); });
    editDropZone.addEventListener('dragleave', () => { editDropZone.classList.remove('dragover'); });
    editDropZone.addEventListener('drop', (e) => { e.preventDefault(); editDropZone.classList.remove('dragover'); handleEditFile(e.dataTransfer.files[0]); });
    editDropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg, application/pdf';
      input.click();
      input.addEventListener('change', () => { handleEditFile(input.files[0]); });
    });

    function handleEditFile(file) {
    if(!file) return;
    editDropZone.textContent = `Archivo cargado: ${file.name}`;
    editPreviewContainer.style.display = 'block';
    cancelEditSectionButton.style.display = 'inline-block';
    openEditorButton.style.display = 'inline-block';
    downloadEditedButton.style.display = 'inline-block';
    if(file.type.startsWith('image/')) {
      editFileType = "image";
      editOriginalMime = file.type;
      const reader = new FileReader();
      reader.onload = function(event) {
        editOriginalData = event.target.result;
        editPreview.src = editOriginalData;
        editPreview.style.display = 'block';
        editPdfCanvas.style.display = 'none';
      };
      reader.readAsDataURL(file);
    } else if(file.type === 'application/pdf') {
    editFileType = "pdf";
    const fileReader = new FileReader();
    fileReader.onload = async function(event) {
        const pdfData = new Uint8Array(event.target.result);
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        editPdfCanvas.width = viewport.width;
        editPdfCanvas.height = viewport.height;
        const ctx = editPdfCanvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        editOriginalData = editPdfCanvas.toDataURL('image/png');
        editPreview.style.display = 'none';
        editPdfCanvas.style.display = 'block';
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      alert('Formato no soportado');
      }
    
    openEditorButton.addEventListener('click', () => {
      if(editOriginalData) { openEditor(editOriginalData);ß }
    });

    downloadEditedButton.addEventListener('click', () => {
      if(editFileType === "image") {
        const { jsPDF } = window.jspdf;
        // Abrir editor para aplicar recorte y filtro antes de descargar
        openEditor(editOriginalData);
        // La descarga se realizará al pulsar "Descargar con filtro escáner" en el modal
      } else if(editFileType === "pdf") {
        openEditor(editOriginalData);
      }
    });

    cancelEditSectionButton.addEventListener('click', () => {
      editDropZone.textContent = 'Arrastra y suelta una imagen o PDF aquí o haz clic para seleccionarlo';
      editPreviewContainer.style.display = 'none';
      openEditorButton.style.display = 'none';
      downloadEditedButton.style.display = 'none';
      cancelEditSectionButton.style.display = 'none';
      editOriginalData = "";
      editFileType = "";
    });
  
  }