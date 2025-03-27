import ui from './ui.js';

class Forms {
    constructor() {
        this.forms = new Map();
        this.validators = new Map();
    }

    initialize(formId, options = {}) {
        const form = document.getElementById(formId);
        if (!form) return;

        this.forms.set(formId, {
            element: form,
            options: {
                validateOnChange: options.validateOnChange || false,
                validateOnBlur: options.validateOnBlur || true,
                submitHandler: options.submitHandler || null,
                ...options
            }
        });

        this._setupFormListeners(formId);
    }

    _setupFormListeners(formId) {
        const form = this.forms.get(formId);
        if (!form) return;

        const { element, options } = form;

        if (options.validateOnChange) {
            element.querySelectorAll('input, select, textarea').forEach(field => {
                field.addEventListener('input', (e) => this._validateField(e.target));
            });
        }

        if (options.validateOnBlur) {
            element.querySelectorAll('input, select, textarea').forEach(field => {
                field.addEventListener('blur', (e) => this._validateField(e.target));
            });
        }

        element.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (await this.validateForm(formId)) {
                const formData = this.getFormData(formId);
                
                if (options.submitHandler) {
                    try {
                        ui.showLoading();
                        await options.submitHandler(formData);
                    } catch (error) {
                        ui.showError(error.message);
                    } finally {
                        ui.hideLoading();
                    }
                }
            }
        });
    }

    addValidator(formId, fieldName, validatorFn) {
        if (!this.validators.has(formId)) {
            this.validators.set(formId, new Map());
        }
        
        const formValidators = this.validators.get(formId);
        if (!formValidators.has(fieldName)) {
            formValidators.set(fieldName, []);
        }
        
        formValidators.get(fieldName).push(validatorFn);
    }

    async _validateField(field) {
        const formId = field.closest('form').id;
        const fieldName = field.name;
        
        const formValidators = this.validators.get(formId);
        if (!formValidators || !formValidators.has(fieldName)) return true;

        const validators = formValidators.get(fieldName);
        const errorContainer = this._getErrorContainer(field);
        
        for (const validator of validators) {
            try {
                await validator(field.value, field);
                this._clearFieldError(field);
            } catch (error) {
                this._showFieldError(field, error.message);
                return false;
            }
        }

        return true;
    }

    async validateForm(formId) {
        const form = this.forms.get(formId);
        if (!form) return false;

        const fields = form.element.querySelectorAll('input, select, textarea');
        let isValid = true;

        for (const field of fields) {
            const fieldValid = await this._validateField(field);
            isValid = isValid && fieldValid;
        }

        return isValid;
    }

    getFormData(formId) {
        const form = this.forms.get(formId);
        if (!form) return null;

        const formData = new FormData(form.element);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }

        return data;
    }

    setFormData(formId, data) {
        const form = this.forms.get(formId);
        if (!form) return;

        for (const [key, value] of Object.entries(data)) {
            const field = form.element.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = Boolean(value);
                } else if (field.type === 'radio') {
                    const radio = form.element.querySelector(`[name="${key}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                } else {
                    field.value = value;
                }
            }
        }
    }

    resetForm(formId) {
        const form = this.forms.get(formId);
        if (!form) return;

        form.element.reset();
        this._clearAllErrors(form.element);
    }

    disableForm(formId) {
        const form = this.forms.get(formId);
        if (!form) return;

        form.element.querySelectorAll('input, select, textarea, button').forEach(element => {
            element.disabled = true;
        });
    }

    enableForm(formId) {
        const form = this.forms.get(formId);
        if (!form) return;

        form.element.querySelectorAll('input, select, textarea, button').forEach(element => {
            element.disabled = false;
        });
    }

    _getErrorContainer(field) {
        let errorContainer = field.nextElementSibling;
        
        if (!errorContainer || !errorContainer.classList.contains('field-error')) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'field-error';
            field.parentNode.insertBefore(errorContainer, field.nextSibling);
        }
        
        return errorContainer;
    }

    _showFieldError(field, message) {
        field.classList.add('is-invalid');
        const errorContainer = this._getErrorContainer(field);
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }

    _clearFieldError(field) {
        field.classList.remove('is-invalid');
        const errorContainer = this._getErrorContainer(field);
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
    }

    _clearAllErrors(form) {
        form.querySelectorAll('.field-error').forEach(error => {
            error.textContent = '';
            error.style.display = 'none';
        });

        form.querySelectorAll('.is-invalid').forEach(field => {
            field.classList.remove('is-invalid');
        });
    }
}

// Встроенные валидаторы
export const validators = {
    required: (message = 'Toto pole je povinné') => {
        return (value) => {
            if (!value || value.trim() === '') {
                throw new Error(message);
            }
        };
    },

    email: (message = 'Zadejte platnou e-mailovou adresu') => {
        return (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) {
                throw new Error(message);
            }
        };
    },

    minLength: (length, message = `Minimální délka je ${length} znaků`) => {
        return (value) => {
            if (value && value.length < length) {
                throw new Error(message);
            }
        };
    },

    maxLength: (length, message = `Maximální délka je ${length} znaků`) => {
        return (value) => {
            if (value && value.length > length) {
                throw new Error(message);
            }
        };
    },

    pattern: (regex, message = 'Hodnota neodpovídá požadovanému formátu') => {
        return (value) => {
            if (value && !regex.test(value)) {
                throw new Error(message);
            }
        };
    },

    match: (otherFieldName, message = 'Hodnoty se neshodují') => {
        return (value, field) => {
            const form = field.closest('form');
            const otherField = form.querySelector(`[name="${otherFieldName}"]`);
            if (otherField && value !== otherField.value) {
                throw new Error(message);
            }
        };
    }
};

const forms = new Forms();
export default forms;