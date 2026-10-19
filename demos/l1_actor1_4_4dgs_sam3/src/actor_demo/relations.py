"""Explicit image-space candidates; no physical contact or action recognition."""
import numpy as np


def mask_box(mask):
    y,x=np.nonzero(mask)
    return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)] if len(x) else None


def infer_relations(entities,masks):
    import cv2
    masks=np.asarray(masks,dtype=bool);h,w=masks.shape[1:];edges=[]
    people=[i for i,e in enumerate(entities) if e['category']=='person' and masks[i].any()]
    objects=[i for i,e in enumerate(entities) if e['category']=='object' and masks[i].any()]
    ground=[i for i,e in enumerate(entities) if e['id']=='ground' and masks[i].any()]
    def edge(subject,obj,predicate,label,family,**evidence):
        edges.append(dict(subject=entities[subject]['id'],object=entities[obj]['id'],predicate=predicate,
            label=label,family=family,space='image-2d',physicalContactEstablished=False,
            provenance='projected-mask-geometry',evidence=evidence))
    for obj in objects:
        oy,ox=np.nonzero(masks[obj]);cx,cy=ox.mean(),oy.mean();candidates=[]
        for person in people:
            x1,y1,x2,y2=mask_box(masks[person]);height=y2-y1
            if not (y1+.18*height<=cy<=y1+.78*height and x1-.08*w<=cx<=x2+.08*w):continue
            distance=cv2.distanceTransform((~masks[person]).astype(np.uint8),cv2.DIST_L2,3)
            gap=float(np.quantile(distance[masks[obj]],.1))
            if gap<=max(3,h*.018):candidates.append((gap+abs(cx-(x1+x2)/2)*.04,person,gap))
        candidates.sort()
        if candidates and (len(candidates)==1 or candidates[1][0]-candidates[0][0]>max(2,w*.008)):
            _,person,gap=candidates[0]
            edge(person,obj,'holding_candidate_2d','持有？ · 二维候选','person-object',boundaryGapPixels=round(gap,2))
    for person in people:
        box=mask_box(masks[person]);lower=masks[person].copy();lower[:round(box[1]+.85*(box[3]-box[1]))]=False
        below=np.zeros_like(lower);below[:-1]=masks[person][1:];lower&=~below
        for g in ground:
            radius=max(2,round(w*.004))
            near=cv2.dilate(masks[g].astype(np.uint8),np.ones((radius*2+1,)*2,np.uint8))>0
            count=int(lower.sum());matched=int((lower&near).sum())
            if count and matched/count>=.25:
                edge(person,g,'lower_boundary_near_ground_2d','下缘邻接地面 · 二维','person-environment',
                    boundaryPixels=count,nearPixels=matched,radiusPixels=radius)
    return edges


def annotation_packet(entities,masks):
    import cv2
    masks=np.asarray(masks,dtype=bool);result=[]
    for entity,mask in zip(entities,masks):
        box=mask_box(mask)
        if box is None or mask.sum()<30:continue
        contours,_=cv2.findContours(mask.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        outlines=[]
        for contour in sorted(contours,key=cv2.contourArea,reverse=True)[:2]:
            if cv2.contourArea(contour)<12:continue
            polygon=cv2.approxPolyDP(contour,max(1.5,mask.shape[1]/600),True).reshape(-1,2)
            if len(polygon)>64:polygon=polygon[np.linspace(0,len(polygon)-1,64).astype(int)]
            outlines.append(polygon.tolist())
        y,x=np.nonzero(mask)
        result.append({**entity,'box':box,'anchor':[round(float(x.mean()),1),round(float(y.mean()),1)],
            'contours':outlines,'visiblePixels':int(mask.sum())})
    visible={e['id'] for e in result}
    relations=[e for e in infer_relations(entities,masks) if e['subject'] in visible and e['object'] in visible]
    return dict(space='image-2d',source='sam3-gaussian-voting',entities=result,relations=relations,
        physicalContactEstablished=False)
