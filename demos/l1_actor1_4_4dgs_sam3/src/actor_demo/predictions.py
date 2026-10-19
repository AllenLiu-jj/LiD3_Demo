"""Name SAM3 detections; match people to projected IDs without claiming contact."""
import numpy as np
from .relations import annotation_packet,mask_box


def predictions_to_annotations(predictions,entities,base=None,allow_reference_seed=False):
    from scipy.optimize import linear_sum_assignment
    if not predictions:return dict(entities=[],relations=[],source='sam3-current-view',space='image-2d')
    entities=[dict(e) for e in entities];shape=predictions[0]['mask'].shape
    people=[p for p in predictions if p['prompt']=='person']
    bases=[e for e in (base or {}).get('entities',[]) if e['category']=='person']
    assignment={}
    if people and bases:
        cost=[]
        for person in people:
            a=mask_box(person['mask']);row=[]
            for b in bases:
                b=b['box'];intersection=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
                union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection
                row.append(1-intersection/max(1,union))
            cost.append(row)
        rows,cols=linear_sum_assignment(cost)
        for row,col in zip(rows,cols):
            if cost[row][col]<.85:assignment[id(people[row])]=next(i for i,e in enumerate(entities) if e['id']==bases[col]['id'])
    elif people and allow_reference_seed and len(people)==2:
        # Used only for the fixed reference camera with a declared left/right seed.
        ordered=sorted(people,key=lambda p:np.nonzero(p['mask'])[1].mean())
        assignment={id(person):i for i,person in enumerate(ordered[:2])}
    for i,person in enumerate(people):
        if id(person) not in assignment:
            assignment[id(person)]=len(entities)
            entities.append(dict(id=f'person-view-{i+1}',name=f'人物（未关联 {i+1}）',category='person',
                color='#d0e5ef',viewLocalId=True))
    masks=np.zeros((len(entities),*shape),bool)
    scores={}
    for item in predictions:
        index=assignment.get(id(item)) if item['prompt']=='person' else item['indices'][0]-1
        if index is None:continue
        if item['score']>scores.get(index,0):
            masks[index]=item['mask'];scores[index]=item['score']
    packet=annotation_packet(entities,masks);packet['source']='sam3-current-view'
    for entity in packet['entities']:
        index=next(i for i,e in enumerate(entities) if e['id']==entity['id'])
        entity['score']=round(scores[index],4);entity['scoreType']='sam3-concept-confidence'
    return packet
