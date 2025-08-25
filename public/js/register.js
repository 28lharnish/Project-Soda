document.getElementById('pfpBox').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const imgPreview = document.getElementById('pfpPreview');
        imgPreview.src = URL.createObjectURL(file);
        imgPreview.style.display = 'block';
    }
});