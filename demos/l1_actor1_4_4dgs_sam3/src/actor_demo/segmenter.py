"""Pinned official SAM3 image API; never downloads implicitly during inference."""
import sys
from pathlib import Path
import numpy as np


class ReferenceSegmenter:
    def __init__(self,source,checkpoint,threshold=.5):
        sys.path.insert(0,str(Path(source).resolve()))
        import torch
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor
        self.torch=torch
        torch.set_num_threads(4)
        self.model=build_sam3_image_model(checkpoint_path=str(checkpoint),load_from_HF=False,
            device='cuda',enable_inst_interactivity=False,compile=False)
        self.processor=Sam3Processor(self.model,device='cuda',confidence_threshold=threshold)

    def segment(self,image,prompts):
        torch=self.torch;result=[]
        with torch.inference_mode(),torch.autocast('cuda',dtype=torch.bfloat16):
            state=self.processor.set_image(image)
            try:
                for prompt in prompts:
                    self.processor.reset_all_prompts(state)
                    output=self.processor.set_text_prompt(prompt=prompt['name'],state=state)
                    used_prompt=prompt['name']
                    for fallback in prompt.get('fallbacks',[]):
                        if len(output['scores']):break
                        self.processor.reset_all_prompts(state);used_prompt=fallback
                        output=self.processor.set_text_prompt(prompt=fallback,state=state)
                    masks=output['masks'].detach().cpu().numpy().reshape(-1,image.height,image.width)
                    scores=output['scores'].detach().float().cpu().numpy().reshape(-1)
                    order=np.argsort(-scores)[:len(prompt['indices'])]
                    for index in order:
                        mask=masks[index].astype(bool)
                        if mask.sum()<50:continue
                        result.append(dict(prompt=prompt['name'],usedPrompt=used_prompt,indices=prompt['indices'],score=float(scores[index]),mask=mask))
            finally:self.processor.reset_all_prompts(state);state.clear()
        return result
