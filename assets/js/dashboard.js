// User Menu Dropdown
document.getElementById('userMenuToggle').addEventListener('click', function() {
    document.getElementById('userDropdown').classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('userDropdown');
    const userMenuToggle = document.getElementById('userMenuToggle');
    
    if (!userMenuToggle.contains(event.target) && !userMenu.contains(event.target)) {
        userMenu.classList.remove('active');
    }
});

// Section Navigation
document.querySelectorAll('[data-section]').forEach(element => {
    element.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to clicked nav link
        if (this.classList.contains('nav-link')) {
            this.classList.add('active');
        }
        
        // Hide all sections
        document.querySelectorAll('.section-container').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section
        const sectionId = this.getAttribute('data-section');
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
    });
});

// Profile Photo Upload Preview
document.getElementById('profilePhoto')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('userAvatar').style.backgroundImage = `url(${e.target.result})`;
        }
        reader.readAsDataURL(file);
    }
});