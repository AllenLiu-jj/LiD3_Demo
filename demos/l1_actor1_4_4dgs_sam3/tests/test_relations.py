import numpy as np
from actor_demo.relations import infer_relations,annotation_packet
from actor_demo.predictions import predictions_to_annotations


def test_relation_families_need_visible_mask_evidence():
    masks=np.zeros((4,100,100),bool)
    masks[0,10:80,10:40]=True;masks[1,10:80,60:90]=True
    masks[2,30:45,30:43]=True;masks[3,80:100,:]=True
    entities=[dict(id='person-a',category='person'),dict(id='person-b',category='person'),
        dict(id='watermelon',category='object'),dict(id='ground',category='environment')]
    edges=infer_relations(entities,masks)
    assert len([e for e in edges if e['family']=='person-object'])==1
    assert len([e for e in edges if e['family']=='person-environment'])==2
    assert all(not e['physicalContactEstablished'] for e in edges)
    packet=annotation_packet(entities,masks)
    assert all('mask' not in e and max(map(len,e['contours']))<=64 for e in packet['entities'])
    masks[2:]=False
    assert infer_relations(entities,masks)==[]


def test_person_without_identity_reference_is_view_local():
    mask=np.zeros((100,100),bool);mask[10:80,20:40]=True
    prediction=dict(prompt='person',indices=[1,2],mask=mask,score=.9)
    entities=[dict(id='person-a',category='person'),dict(id='person-b',category='person')]
    packet=predictions_to_annotations([prediction],entities)
    assert packet['source']=='sam3-current-view'
    assert packet['entities'][0]['id'].startswith('person-view-')
