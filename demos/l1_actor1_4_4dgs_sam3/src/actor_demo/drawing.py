from PIL import ImageDraw

def draw_annotation(image,data,font):
    draw=ImageDraw.Draw(image)
    def text(value,position,color):
        x,y=position;box=draw.textbbox((0,0),value,font=font);w=box[2]+12;h=box[3]-box[1]+10
        x=max(3,min(image.width-w-3,x));y=max(3,min(image.height-h-3,y))
        draw.rounded_rectangle((x,y,x+w,y+h),radius=3,fill=(12,22,30))
        draw.text((x+6,y+3-box[1]),value,font=font,fill=color)
    for entity in data['entities']:
        if entity['category']=='environment':continue
        color=entity['color']
        for contour in entity['contours']:
            if len(contour)<3:continue
            points=[tuple(p) for p in contour];points.append(points[0])
            draw.line(points,fill=(8,15,22),width=5);draw.line(points,fill=color,width=2)
        text(entity['name'],(entity['box'][0],entity['box'][1]-30),color)
    lookup={e['id']:e for e in data['entities']}
    for relation in data['relations']:
        a=lookup[relation['subject']];b=lookup[relation['object']]
        source=a['anchor'];target=b['anchor']
        if relation['family']=='person-environment':
            source=[(a['box'][0]+a['box'][2])/2,a['box'][3]];target=[source[0]+55,b['anchor'][1]]
        draw.line([tuple(source),tuple(target)],fill=(240,247,250),width=2)
        text(relation['label'],((source[0]+target[0])/2+8,(source[1]+target[1])/2),(240,247,250))
    return image
