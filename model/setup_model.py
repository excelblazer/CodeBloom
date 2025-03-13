import os
import logging
from transformers import AutoTokenizer, AutoModelForCausalLM
from tqdm import tqdm
import torch
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_model():
    """Download and set up the DeepSeek Coder model."""
    load_dotenv()
    
    MODEL_NAME = "deepseek-ai/deepseek-coder-1.3b-base"
    MODEL_PATH = os.getenv('MODEL_PATH', './model/deepseek-coder-1.3b')
    
    try:
        logger.info(f"Downloading model {MODEL_NAME}...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        
        logger.info("Converting model to CPU format...")
        model = model.to('cpu')
        
        logger.info(f"Saving model to {MODEL_PATH}...")
        os.makedirs(MODEL_PATH, exist_ok=True)
        model.save_pretrained(MODEL_PATH)
        tokenizer.save_pretrained(MODEL_PATH)
        
        logger.info("Model setup completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Error setting up model: {e}")
        return False

if __name__ == "__main__":
    setup_model()
