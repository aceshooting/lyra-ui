import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphPresentationSnapshotWork } from '../dist/graph/presentation-work.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const STYLE_ORACLES = {
  defaults: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  authored: {'background':{'r':0.06666666666666667,'g':0.13333333333333333,'b':0.2,'a':0.26666666666666666},'foreground':{'r':0.12549019607843137,'g':0.25098039215686274,'b':0.3764705882352941,'a':1},'muted':{'r':0.0784313725490196,'g':0.1568627450980392,'b':0.23529411764705882,'a':0.3},'accent':{'r':0.6274509803921569,'g':0.6901960784313725,'b':0.7529411764705882,'a':1},'focus':{'r':0.8156862745098039,'g':0.8784313725490196,'b':0.9411764705882353,'a':1},'palette':[{'r':0.06274509803921569,'g':0.12549019607843137,'b':0.18823529411764706,'a':1},{'r':0.12549019607843137,'g':0.25098039215686274,'b':0.3764705882352941,'a':0.2}],'fontFamily':'serif','fontSize':18,'pointSize':14,'lineWidth':3,'devicePixelRatio':2,'reducedMotion':true,'forcedColors':true},
  partial: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.6705882352941176,'g':0.803921568627451,'b':0.9372549019607843,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':1,'g':0,'b':0,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':30,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  inheritedFields: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.07058823529411765,'g':0.20392156862745098,'b':0.33725490196078434,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  accessorFields: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  invalidScalars: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  clampLow: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':1,'pointSize':0,'lineWidth':0,'devicePixelRatio':0.25,'reducedMotion':false,'forcedColors':false},
  clampHigh: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':256,'pointSize':1024,'lineWidth':64,'devicePixelRatio':4,'reducedMotion':false,'forcedColors':false},
  nonFinite: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  booleans: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':true,'forcedColors':false},
  fontWhitespace: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':1,'pointSize':0,'lineWidth':0,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  colorForms: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.6666666666666666,'g':0.7333333333333333,'b':0.8,'a':0.8666666666666667},'muted':{'r':0.1,'g':0.2,'b':0.3,'a':0.5},'accent':{'r':0.1,'g':0.4,'b':1,'a':0.25},'focus':{'r':0.047058823529411764,'g':0.13333333333333333,'b':0.2196078431372549,'a':0.75},'palette':[{'r':0.07058823529411765,'g':0.20392156862745098,'b':0.33725490196078434,'a':0.47058823529411764},{'r':1,'g':0,'b':0.6666666666666666,'a':1},{'r':1,'g':0,'b':0.5019607843137255,'a':0.4}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  invalidColors: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  emptyPalette: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  invalidPalette: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.3058823529411765,'g':0.4745098039215686,'b':0.6549019607843137,'a':1},{'r':0.9490196078431372,'g':0.5568627450980392,'b':0.16862745098039217,'a':1},{'r':0.8823529411764706,'g':0.3411764705882353,'b':0.34901960784313724,'a':1},{'r':0.4627450980392157,'g':0.7176470588235294,'b':0.6980392156862745,'a':1},{'r':0.34901960784313724,'g':0.6313725490196078,'b':0.30980392156862746,'a':1},{'r':0.9294117647058824,'g':0.788235294117647,'b':0.2823529411764706,'a':1},{'r':0.6901960784313725,'g':0.47843137254901963,'b':0.6313725490196078,'a':1},{'r':1,'g':0.615686274509804,'b':0.6549019607843137,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  sparsePalette: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.00392156862745098,'g':0.00784313725490196,'b':0.011764705882352941,'a':1},{'r':0.01568627450980392,'g':0.0196078431372549,'b':0.023529411764705882,'a':1},{'r':0.0392156862745098,'g':0.043137254901960784,'b':0.047058823529411764,'a':1},{'r':0.027450980392156862,'g':0.03137254901960784,'b':0.03529411764705882,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  cappedPalette: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1},{'r':1,'g':0,'b':0,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
  proxyPalette: {'background':{'r':0,'g':0,'b':0,'a':0},'foreground':{'r':0.10588235294117647,'g':0.12156862745098039,'b':0.1411764705882353,'a':1},'muted':{'r':0.4196078431372549,'g':0.4470588235294118,'b':0.5019607843137255,'a':1},'accent':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'focus':{'r':0.011764705882352941,'g':0.3686274509803922,'b':0.7764705882352941,'a':1},'palette':[{'r':0.00392156862745098,'g':0.00784313725490196,'b':0.011764705882352941,'a':1},{'r':0.01568627450980392,'g':0.0196078431372549,'b':0.023529411764705882,'a':1}],'fontFamily':'system-ui, sans-serif','fontSize':12,'pointSize':6,'lineWidth':1,'devicePixelRatio':1,'reducedMotion':false,'forcedColors':false},
};
const STATE_ORACLES = {
  empty: {'selected':[],'dimmed':[],'hover':-1,'focus':-1},
  ordered: {'selected':[3,1,8],'dimmed':[8,1],'hover':4,'focus':2},
  duplicateIterable: {'selected':[4,2,1],'dimmed':[3,2],'hover':-1,'focus':4},
  specialNumbers: {'selected':[0,{'number':'NaN'},{'number':'Infinity'},{'number':'-Infinity'}],'dimmed':[{'number':'NaN'},0],'hover':{'number':'-0'},'focus':{'number':'NaN'}},
  outsideRows: {'selected':[-2,0.5,999999999],'dimmed':[{'number':'-Infinity'},40],'hover':{'number':'Infinity'},'focus':-123.5},
  undefinedCollections: {'selected':[],'dimmed':[],'hover':-1,'focus':-1},
  nullCollections: {'selected':[],'dimmed':[],'hover':-1,'focus':-1},
};
const ITERATOR_TRACES = {'normal':['get iterator','call iterator','get next','call next','get done 0','get value 0','call next','get done 1','get value 1','call next','get done 2'],'iterator-get':['get iterator'],'iterator-call':['get iterator','call iterator'],'next-get':['get iterator','call iterator','get next'],'next-call':['get iterator','call iterator','get next','call next'],'done-get':['get iterator','call iterator','get next','call next','get done 0'],'value-get':['get iterator','call iterator','get next','call next','get done 0','get value 0'],'adder-throw':['get iterator','call iterator','get next','call next','get done 0','get value 0','throw adder','get return','call return'],'return-get':['get iterator','call iterator','get next','call next','get done 0','get value 0','throw adder','get return'],'return-call':['get iterator','call iterator','get next','call next','get done 0','get value 0','throw adder','get return','call return']};
const PALETTE_TRACES = {'sparsePalette':[['get','inherited-1'],['get','own-4']],'proxyPalette':[['get','slice'],['get','length'],['get','constructor'],['has','0'],['get','0'],['has','1'],['has','2'],['get','2']]};

function encode(value) {
  if (value === undefined) return { value: 'undefined' };
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return { number: '-0' };
    if (!Number.isFinite(value)) return { number: String(value) };
    return value;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'symbol') return { symbol: value.description };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  return { type: typeof value };
}
function styleInput(name, trace) {
  switch (name) {
    case 'defaults': return undefined;
    case 'authored': return { background: '#1234', foreground: '#204060', muted: 'rgba(20, 40, 60, 0.3)', accent: '#a0b0c0', focus: '#d0e0f0',
      palette: ['#102030', 'rgba(32, 64, 96, 0.2)'], fontFamily: '  serif  ', fontSize: 18, pointSize: 14, lineWidth: 3,
      devicePixelRatio: 2, reducedMotion: true, forcedColors: true };
    case 'partial': return { foreground: '#abcdef', pointSize: 30, palette: ['#f00'] };
    case 'inheritedFields': return Object.assign(Object.create({ foreground: '#ff0000', palette: ['#00ff00'], pointSize: 90 }), { muted: '#123456' });
    case 'accessorFields': {
      const value = {};
      for (const key of ['foreground', 'palette', 'fontSize']) Object.defineProperty(value, key, { enumerable: true, get() { trace.push(['get', key]); throw new Error('style accessor must not run'); } });
      return value;
    }
    case 'invalidScalars': return { background: {}, foreground: 5, muted: null, accent: ['#fff'], focus: true, palette: false,
      fontFamily: { text: 'serif' }, fontSize: '18', pointSize: null, lineWidth: true, devicePixelRatio: {}, reducedMotion: 1, forcedColors: 'true' };
    case 'clampLow': return { fontSize: -1, pointSize: -1, lineWidth: -1, devicePixelRatio: -1 };
    case 'clampHigh': return { fontSize: 1000, pointSize: 2000, lineWidth: 100, devicePixelRatio: 9 };
    case 'nonFinite': return { fontSize: NaN, pointSize: Infinity, lineWidth: -Infinity, devicePixelRatio: NaN };
    case 'booleans': return { reducedMotion: true, forcedColors: false };
    case 'fontWhitespace': return { fontFamily: ' \t\n ', fontSize: 0, pointSize: -0, lineWidth: -0 };
    case 'colorForms': return { background: 'transparent', foreground: '#AbCd', muted: 'rgba(10%, 20%, 30%, 50%)',
      accent: 'color(srgb 0.1 0.4 1 / 0.25)', focus: 'rgb(12 34 56 / 0.75)', palette: ['#12345678', '#f0a', 'rgba(255, 0, 128, 0.4)'] };
    case 'invalidColors': return { background: 'var(--color)', foreground: 'red', muted: '#xyz', accent: 'rgb(1, 2)', focus: null };
    case 'emptyPalette': return { palette: [] };
    case 'invalidPalette': return { palette: [null, {}, '#no', 5, 'var(--x)'] };
    case 'sparsePalette': {
      const palette = new Array(7), prototype = Object.create(Array.prototype);
      Object.defineProperty(prototype, '1', { configurable: true, get() { trace.push(['get', 'inherited-1']); return '#010203'; } });
      Object.setPrototypeOf(palette, prototype);
      palette[2] = 'bad'; palette[3] = '#040506'; palette[6] = '#070809';
      Object.defineProperty(palette, '4', { configurable: true, get() { trace.push(['get', 'own-4']); return '#0a0b0c'; } });
      return { palette };
    }
    case 'cappedPalette': return { palette: Array.from({ length: 258 }, (_, index) => index < 256 ? index % 2 ? '#f00' : 'bad' : '#0f0') };
    case 'proxyPalette': {
      const palette = ['#010203', '#ff0000', '#040506'];
      return { palette: new Proxy(palette, {
        get(target, key, receiver) { trace.push(['get', String(key)]); return Reflect.get(target, key, receiver); },
        has(target, key) { trace.push(['has', String(key)]); return key === '1' ? false : Reflect.has(target, key); },
      }) };
    }
    default: throw new Error(`Unknown style fixture ${name}`);
  }
}
const emptyState = () => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
function stateInput(name, trace) {
  const state = emptyState();
  switch (name) {
    case 'empty': return state;
    case 'ordered': return { selected: new Set([3, 1, 8]), dimmed: new Set([8, 1]), hover: 4, focus: 2 };
    case 'duplicateIterable': return { selected: [4, 2, 4, 1, 2], dimmed: [3, 3, 2], hover: -1, focus: 4 };
    case 'specialNumbers': return { selected: [-0, 0, NaN, NaN, Infinity, -Infinity], dimmed: [NaN, -0], hover: -0, focus: NaN };
    case 'outsideRows': return { selected: [-2, 0.5, 999999999], dimmed: [-Infinity, 40], hover: Infinity, focus: -123.5 };
    case 'undefinedCollections': return { selected: undefined, dimmed: undefined, hover: -1, focus: -1 };
    case 'nullCollections': return { selected: null, dimmed: null, hover: -1, focus: -1 };
    case 'missingFields': return {};
    case 'inheritedFields': return Object.create({ selected: new Set([7]), dimmed: new Set([8]), hover: 9, focus: 10 });
    case 'accessorFields': {
      for (const [key, value] of Object.entries({ selected: new Set([2]), dimmed: new Set([3]), hover: 4, focus: 5 })) {
        Object.defineProperty(state, key, { enumerable: true, configurable: true, get() { trace.push(['get', key]); return value; } });
      }
      return state;
    }
    case 'nonnumericMembers': return { ...state, selected: ['4', { marker: 'selected-object' }, true], dimmed: [null, undefined] };
    case 'nonnumericScalars': return { ...state, hover: '3', focus: { marker: 'focus-object' } };
    case 'noniterable': return { ...state, selected: 7 };
    default: throw new Error(`Unknown state fixture ${name}`);
  }
}
function iteratorInput(mode, trace) {
  let index = 0;
  const fail = at => { if (mode === at) throw new Error(at); };
  const iterator = {};
  Object.defineProperty(iterator, 'next', { get() {
    trace.push('get next'); fail('next-get');
    return function () {
      assert.equal(this, iterator); trace.push('call next'); fail('next-call');
      const row = index++, result = {};
      Object.defineProperty(result, 'done', { get() { trace.push(`get done ${row}`); fail('done-get'); return row >= 2; } });
      Object.defineProperty(result, 'value', { get() { trace.push(`get value ${row}`); fail('value-get'); return row === 0 ? 9 : 4; } });
      return result;
    };
  } });
  Object.defineProperty(iterator, 'return', { get() {
    trace.push('get return'); fail('return-get');
    return function () { assert.equal(this, iterator); trace.push('call return'); fail('return-call'); return {}; };
  } });
  const source = {};
  Object.defineProperty(source, Symbol.iterator, { get() {
    trace.push('get iterator'); fail('iterator-get');
    return function () { assert.equal(this, source); trace.push('call iterator'); fail('iterator-call'); return iterator; };
  } });
  return source;
}

const invalidState = error => error?.name === 'InvalidStateError';
const aborted = error => error?.name === 'AbortError' || error?.name === 'InvalidStateError';
const paletteVisits = { defaults: 8, authored: 2, partial: 1, inheritedFields: 0, accessorFields: 0, invalidScalars: 0,
  clampLow: 0, clampHigh: 0, nonFinite: 0, booleans: 0, fontWhitespace: 0, colorForms: 3, invalidColors: 0,
  emptyPalette: 0, invalidPalette: 5, sparsePalette: 7, cappedPalette: 256, proxyPalette: 3 };
const stateEntries = { empty: 0, ordered: 5, duplicateIterable: 8, specialNumbers: 8, outsideRows: 5, undefinedCollections: 0, nullCollections: 0 };
function input(presentation, inheritedState = emptyState(), inheritedStyle = resolveLyra3dStyle()) {
  return { presentation, inheritedStyle, inheritedState };
}
function finish(work, budget = 4096) {
  const totals = { operations: 0, visitedPaletteEntries: 0, copiedStateEntries: 0 };
  for (let calls = 0; calls < 1000000; calls++) {
    const step = work.step(budget);
    for (const field of Object.keys(totals)) {
      assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0, field); totals[field] += step[field];
    }
    assert.ok(step.operations <= budget);
    assert.ok(step.visitedPaletteEntries + step.copiedStateEntries <= step.operations);
    if (step.done) { assert.ok(step.value); return { value: step.value, totals }; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('Presentation snapshot did not finish');
}
function snapshot(value) {
  return { style: encode(value.style), state: { selected: [...value.state.selected].map(encode), dimmed: [...value.state.dimmed].map(encode),
    hover: encode(value.state.hover), focus: encode(value.state.focus) }, inheritsStyle: value.inheritsStyle, inheritsState: value.inheritsState };
}
function counts(result, palette, entries) {
  assert.deepEqual(result.totals, { operations: 28 + palette + entries, visitedPaletteEntries: palette, copiedStateEntries: entries });
}
function withProperty(object, key, descriptor, action) {
  const previous = Object.getOwnPropertyDescriptor(object, key);
  Object.defineProperty(object, key, descriptor);
  try { return action(); }
  finally { if (previous) Object.defineProperty(object, key, previous); else delete object[key]; }
}

for (const [name, expected] of Object.entries(STYLE_ORACLES)) {
  test(`prospective ${name} style preserves frozen values across budgets`, () => {
    for (const budget of [1, 7, 4096]) {
      const trace = [], raw = styleInput(name, trace), source = input({ style: raw }), work = createGraphPresentationSnapshotWork(source);
      try {
        const result = finish(work, budget); counts(result, paletteVisits[name], 0);
        assert.deepEqual(snapshot(result.value), { style: expected, state: STATE_ORACLES.empty, inheritsStyle: name === 'defaults', inheritsState: true });
        assert.equal(Object.isFrozen(result.value.style), true); assert.equal(Object.isFrozen(result.value.style.palette), true);
        assert.equal([result.value.style.background, result.value.style.foreground, result.value.style.muted, result.value.style.accent,
          result.value.style.focus, ...result.value.style.palette].every(Object.isFrozen), true);
        assert.notEqual(result.value.style.palette, source.inheritedStyle.palette);
        const expectedTrace = (PALETTE_TRACES[name] ?? []).filter(row => !(row[0] === 'get' && ['slice', 'constructor'].includes(row[1])));
        assert.deepEqual(trace, expectedTrace);
        work.dispose(); assert.deepEqual(encode(result.value.style), expected); assert.throws(() => work.step(0), invalidState);
      } finally { work.dispose(); }
    }
  });
}

for (const [name, expected] of Object.entries(STATE_ORACLES)) {
  test(`prospective ${name} state preserves numeric membership and scalar values`, () => {
    for (const budget of [1, 7, 4096]) {
      const trace = [], raw = stateInput(name, trace), work = createGraphPresentationSnapshotWork(input({ state: raw }));
      try {
        const result = finish(work, budget); counts(result, 8, stateEntries[name]);
        assert.deepEqual(snapshot(result.value), { style: STYLE_ORACLES.defaults, state: expected, inheritsStyle: true, inheritsState: false });
        assert.notEqual(result.value.state, raw); assert.notEqual(result.value.state.selected, raw.selected); assert.notEqual(result.value.state.dimmed, raw.dimmed);
        assert.deepEqual(trace, []);
      } finally { work.dispose(); }
    }
  });
}

test('presentation descriptors select inherited and explicit style/state independently', () => {
  const inheritedStyle = resolveLyra3dStyle(styleInput('authored', [])), inheritedState = stateInput('ordered', []);
  for (const presentation of [undefined, {}, { style: undefined, state: undefined }, Object.create({ style: {}, state: emptyState() })]) {
    const work = createGraphPresentationSnapshotWork(input(presentation, inheritedState, inheritedStyle));
    try {
      const result = finish(work, 1); counts(result, 2, 5);
      assert.deepEqual(snapshot(result.value), { style: STYLE_ORACLES.authored, state: STATE_ORACLES.ordered, inheritsStyle: true, inheritsState: true });
    } finally { work.dispose(); }
  }
  for (const presentation of [{ style: {} }, { state: emptyState() }]) {
    const work = createGraphPresentationSnapshotWork(input(presentation, inheritedState, inheritedStyle));
    try {
      const result = finish(work, 7), styleOnly = 'style' in presentation;
      counts(result, styleOnly ? 0 : 2, styleOnly ? 5 : 0);
      assert.deepEqual(snapshot(result.value), { style: styleOnly ? STYLE_ORACLES.defaults : STYLE_ORACLES.authored,
        state: styleOnly ? STATE_ORACLES.ordered : STATE_ORACLES.empty, inheritsStyle: !styleOnly, inheritsState: styleOnly });
    } finally { work.dispose(); }
  }
});

test('prospective descriptor admission rejects accessors without invoking them and ignores unrelated keys', () => {
  let reads = 0;
  for (const key of ['style', 'state']) {
    const presentation = Object.defineProperty({}, key, { get() { reads++; return {}; } });
    const work = createGraphPresentationSnapshotWork(input(presentation));
    try { assert.throws(() => finish(work, 1), { name: 'TypeError' }); } finally { work.dispose(); }
  }
  for (const key of ['selected', 'dimmed', 'hover', 'focus']) {
    const state = Object.defineProperty(emptyState(), key, { get() { reads++; return 0; } });
    const work = createGraphPresentationSnapshotWork(input({ state }));
    try { assert.throws(() => finish(work, 1), { name: 'TypeError' }); } finally { work.dispose(); }
  }
  for (const presentation of [null, 0, false, 'value']) {
    const work = createGraphPresentationSnapshotWork(input(presentation));
    try { assert.throws(() => finish(work, 1), { name: 'TypeError' }); } finally { work.dispose(); }
  }
  const presentation = new Proxy({ state: emptyState() }, { ownKeys() { assert.fail('presentation keys must not be enumerated'); },
    get() { assert.fail('presentation values must come from own descriptors'); },
    getOwnPropertyDescriptor(target, key) { assert.ok(key === 'style' || key === 'state'); return Reflect.getOwnPropertyDescriptor(target, key); } });
  const work = createGraphPresentationSnapshotWork(input(presentation));
  try { finish(work, 1); assert.equal(reads, 0); } finally { work.dispose(); }
});

test('prospective state rejects nonnumeric members and hover/focus without coercion', () => {
  const invalid = [undefined, null, '3', true, {}, [], Symbol('row'), 3n, () => 3];
  for (const value of invalid) for (const key of ['hover', 'focus', 'selected', 'dimmed']) {
    const state = { ...emptyState(), [key]: key === 'hover' || key === 'focus' ? value : [value] };
    const work = createGraphPresentationSnapshotWork(input({ state }));
    try { assert.throws(() => finish(work, 1), { name: 'TypeError' }); assert.throws(() => work.step(1), invalidState); }
    finally { work.dispose(); }
  }
  for (const state of [null, 1, false, {}, Object.create({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 })]) {
    const work = createGraphPresentationSnapshotWork(input({ state }));
    try { assert.throws(() => finish(work, 1), { name: 'TypeError' }); } finally { work.dispose(); }
  }
});

test('undefined explicit state inherits while null and undefined collections copy as empty', () => {
  for (const value of [null, undefined]) {
    const work = createGraphPresentationSnapshotWork(input({ state: { selected: value, dimmed: value, hover: -0, focus: Infinity } }));
    try {
      const result = finish(work, 1); counts(result, 8, 0);
      assert.deepEqual([...result.value.state.selected], []); assert.deepEqual([...result.value.state.dimmed], []);
      assert.equal(Object.is(result.value.state.hover, -0), true); assert.equal(result.value.state.focus, Infinity);
    } finally { work.dispose(); }
  }
});

for (const mode of ['normal', 'iterator-get', 'iterator-call', 'next-get', 'next-call', 'done-get', 'value-get']) {
  test(`snapshot iteration retains native ${mode} acquisition and abrupt-completion behavior`, () => {
    for (const budget of [1, 7, 4096]) {
      const trace = [], selected = iteratorInput(mode, trace), work = createGraphPresentationSnapshotWork(input({ state: { ...emptyState(), selected } }));
      try {
        if (mode === 'normal') {
          const result = finish(work, budget); counts(result, 8, 2); assert.deepEqual([...result.value.state.selected], [9, 4]);
        } else assert.throws(() => finish(work, budget), error => error.message === mode);
        assert.deepEqual(trace, ITERATOR_TRACES[mode]); work.dispose(); assert.deepEqual(trace, ITERATOR_TRACES[mode]);
      } finally { work.dispose(); }
    }
  });
}

for (const mode of ['adder-throw', 'return-get', 'return-call']) {
  test(`snapshot iterator closing retains original adder failure with ${mode}`, () => {
    const trace = [], selected = iteratorInput(mode, trace), source = input({ state: { ...emptyState(), selected } });
    const work = createGraphPresentationSnapshotWork(source), descriptor = Object.getOwnPropertyDescriptor(Set.prototype, 'add'), add = Set.prototype.add;
    withProperty(Set.prototype, 'add', { ...descriptor, value(value) {
      if (value === 9) { trace.push('throw adder'); throw new Error('adder-throw'); } return add.call(this, value);
    } }, () => {
      try { assert.throws(() => finish(work, 1), error => error.message === 'adder-throw'); assert.deepEqual(trace, ITERATOR_TRACES[mode]); }
      finally { work.dispose(); }
    });
    assert.deepEqual(trace, ITERATOR_TRACES[mode]); assert.throws(() => work.step(1), invalidState);
  });
}

function tracked(values, events, label, boundary = () => {}) {
  let index = 0;
  const hit = name => { const event = `${label}:${name}`; events.push(event); boundary(event); };
  const iterator = {
    get next() { hit('next-get'); return function () {
      assert.equal(this, iterator); hit('next-call'); const row = index++;
      return { get done() { hit(`done-${row}`); return row === values.length; }, get value() { hit(`value-${row}`); return values[row]; } };
    }; },
    get return() { hit('return-get'); return function () { assert.equal(this, iterator); hit('return-call'); return {}; }; },
  };
  const source = { get [Symbol.iterator]() { hit('iterator-get'); return function () { assert.equal(this, source); hit('iterator-call'); return iterator; }; },
    get size() { assert.fail('iteration must not read a collection size'); } };
  return source;
}
function watchedSource(events, boundary) {
  return input({ style: { palette: ['#123456', '#abcdef', 'bad'] }, state: {
    selected: tracked([2, 2, 4], events, 'selected', boundary), dimmed: tracked([4, 5], events, 'dimmed', boundary), hover: 1, focus: -1,
  } });
}

test('snapshot construction is inert and closed/running checks precede budget validation', () => {
  let reads = 0, guards = 0;
  const source = new Proxy({}, { get() { reads++; assert.fail('construction read input'); } });
  const inert = createGraphPresentationSnapshotWork(source, () => { guards++; return true; });
  assert.equal(reads, 0); assert.equal(guards, 0); inert.dispose(); inert.dispose(); assert.throws(() => inert.step(0), invalidState);
  const work = createGraphPresentationSnapshotWork(input());
  try {
    for (const budget of [0, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), { name: 'RangeError' });
    finish(work, 1); assert.throws(() => work.step(0), invalidState);
  } finally { work.dispose(); }
});

test('every partial snapshot cursor can close idempotently without another input advance', () => {
  const control = createGraphPresentationSnapshotWork(watchedSource([], () => {})); let total;
  try { total = finish(control, 1).totals.operations; } finally { control.dispose(); }
  for (let stop = 0; stop < total; stop++) {
    const events = [], work = createGraphPresentationSnapshotWork(watchedSource(events, () => {}));
    for (let step = 0; step < stop; step++) assert.equal(work.step(1).done, false);
    const before = events.length; work.dispose(); work.dispose(); assert.throws(() => work.step(1), invalidState);
    assert.equal(events.slice(before).every(event => event.includes('return-')), true);
    for (const label of ['selected', 'dimmed']) assert.ok(events.filter(event => event === `${label}:return-call`).length <= 1);
  }
});

test('every stale guard including final transfer closes only its own snapshot', () => {
  let total = 0; const control = createGraphPresentationSnapshotWork(watchedSource([], () => {}), () => { total++; return true; });
  try { finish(control, 1); } finally { control.dispose(); }
  for (let stop = 1; stop <= total; stop++) {
    let calls = 0; const events = [], work = createGraphPresentationSnapshotWork(watchedSource(events, () => {}), () => ++calls !== stop);
    assert.throws(() => finish(work, 1), { name: 'AbortError' }); assert.equal(calls, stop);
    for (const label of ['selected', 'dimmed']) assert.ok(events.filter(event => event === `${label}:return-call`).length <= 1);
    work.dispose(); assert.throws(() => work.step(1), invalidState);
  }
});

test('each iterator getter/call boundary fences disposal, replacement and nested stepping', () => {
  const baselineEvents = [], control = createGraphPresentationSnapshotWork(watchedSource(baselineEvents, () => {}));
  try { finish(control, 1); } finally { control.dispose(); }
  for (let stop = 1; stop <= baselineEvents.length; stop++) for (const mode of ['dispose', 'stale', 'reenter']) {
    const events = []; let calls = 0, current = true, work, triggered = false;
    const source = watchedSource(events, () => {
      if (++calls !== stop) return;
      triggered = true;
      if (mode === 'dispose') work.dispose();
      else if (mode === 'stale') current = false;
      else assert.throws(() => work.step(0), invalidState);
    });
    work = createGraphPresentationSnapshotWork(source, () => current);
    try {
      if (mode === 'reenter') counts(finish(work, 1), 3, 5);
      else assert.throws(() => finish(work, 1), mode === 'stale' ? { name: 'AbortError' } : aborted);
      assert.equal(triggered, true);
      if (mode !== 'reenter') assert.equal(events.slice(stop).every(event => event.includes('return-')), true);
      for (const label of ['selected', 'dimmed']) assert.ok(events.filter(event => event === `${label}:return-call`).length <= 1);
    } finally { work.dispose(); }
  }
});

test('guard failures survive throwing iterator cleanup and cleanup reentry remains closed', () => {
  const original = new Error('guard failed'), cleanup = new Error('cleanup failed'); let fail = false, work, returns = 0;
  const selected = { [Symbol.iterator]() { return { next() { return { done: false, value: 1 }; },
    return() { returns++; assert.throws(() => work.step(0), invalidState); work.dispose(); throw cleanup; } }; } };
  work = createGraphPresentationSnapshotWork(input({ state: { ...emptyState(), selected } }), () => { if (fail) throw original; return true; });
  try {
    let copied = false;
    for (let calls = 0; calls < 100; calls++) { const step = work.step(1); if (step.copiedStateEntries) { copied = true; break; } }
    assert.equal(copied, true); fail = true; assert.throws(() => work.step(1), error => error === original); assert.equal(returns, 1);
    work.dispose(); assert.equal(returns, 1); assert.throws(() => work.step(1), invalidState);
  } finally { work.dispose(); }
});

test('explicit disposal and false guards close each known-open collection exactly once', () => {
  for (const label of ['selected', 'dimmed']) for (const mode of ['dispose', 'stale']) {
    const events = []; let current = true, copied = 0;
    const work = createGraphPresentationSnapshotWork(watchedSource(events, () => {}), () => current);
    try {
      const threshold = label === 'selected' ? 1 : 4;
      while (copied < threshold) { const step = work.step(1); assert.equal(step.done, false); copied += step.copiedStateEntries; }
      if (mode === 'dispose') work.dispose();
      else { current = false; assert.throws(() => work.step(1), { name: 'AbortError' }); }
      assert.equal(events.filter(event => event === `${label}:return-get`).length, 1);
      assert.equal(events.filter(event => event === `${label}:return-call`).length, 1);
      const other = label === 'selected' ? 'dimmed' : 'selected';
      assert.equal(events.filter(event => event === `${other}:return-call`).length, 0);
      work.dispose(); assert.equal(events.filter(event => event === `${label}:return-call`).length, 1);
      assert.throws(() => work.step(1), invalidState);
    } finally { work.dispose(); }
  }
});

test('every guard refuses nested stepping and cannot transfer after disposing then returning true', () => {
  let total = 0; const control = createGraphPresentationSnapshotWork(watchedSource([], () => {}), () => { total++; return true; });
  try { finish(control, 1); } finally { control.dispose(); }
  for (let stop = 1; stop <= total; stop++) for (const mode of ['dispose', 'reenter']) {
    let calls = 0, work;
    work = createGraphPresentationSnapshotWork(watchedSource([], () => {}), () => {
      if (++calls === stop) {
        if (mode === 'dispose') work.dispose(); else assert.throws(() => work.step(0), invalidState);
      }
      return true;
    });
    try {
      if (mode === 'dispose') { assert.throws(() => finish(work, 1), aborted); assert.equal(calls, stop); }
      else { counts(finish(work, 1), 3, 5); assert.equal(calls, total); }
      assert.throws(() => work.step(1), invalidState);
    } finally { work.dispose(); }
  }
});

test('iterator acquisition and advance failures retain the original exception without iterator closing', () => {
  for (const boundary of ['iterator-get', 'iterator-call', 'next-get', 'next-call', 'done-0', 'value-0']) {
    const events = [], original = new Error('iterator boundary failed');
    const selected = tracked([1], events, 'selected', event => { if (event === `selected:${boundary}`) throw original; });
    const work = createGraphPresentationSnapshotWork(input({ state: { ...emptyState(), selected } }));
    try {
      assert.throws(() => finish(work, 1), error => error === original);
      assert.equal(events.some(event => event.includes('return-')), false);
      work.dispose(); assert.equal(events.some(event => event.includes('return-')), false);
    } finally { work.dispose(); }
  }
});

test('malformed collections reject and numeric validation closes a yielded iterator despite cleanup failure', () => {
  const malformed = [7, true, {}, { [Symbol.iterator]: 3 }, { [Symbol.iterator]() { return 3; } },
    { [Symbol.iterator]() { return { next: 3 }; } }, { [Symbol.iterator]() { return { next() { return 3; } }; } }];
  for (const value of malformed) for (const key of ['selected', 'dimmed']) {
    const work = createGraphPresentationSnapshotWork(input({ state: { ...emptyState(), [key]: value } }));
    try { assert.throws(() => finish(work, 1), { name: 'TypeError' }); } finally { work.dispose(); }
  }
  for (const key of ['selected', 'dimmed']) {
    let returned = 0;
    const collection = { [Symbol.iterator]() { return { next() { return { done: false, value: {} }; },
      return() { returned++; throw new Error('iterator cleanup failed'); } }; } };
    const work = createGraphPresentationSnapshotWork(input({ state: { ...emptyState(), [key]: collection } }));
    try {
      assert.throws(() => finish(work, 1), { name: 'TypeError' }); assert.equal(returned, 1);
      work.dispose(); assert.equal(returned, 1); assert.throws(() => work.step(1), invalidState);
    } finally { work.dispose(); }
  }
});

test('owned snapshot remains usable after source mutation, revocation and work disposal', () => {
  const palette = ['#123456'], selected = [3, 1], dimmed = [3], state = { selected, dimmed, hover: -0, focus: 3 };
  const proxies = [Proxy.revocable(palette, {}), Proxy.revocable(selected, {}), Proxy.revocable(dimmed, {})];
  const stateProxy = Proxy.revocable({ ...state, selected: proxies[1].proxy, dimmed: proxies[2].proxy }, {});
  const presentation = Proxy.revocable({ style: { palette: proxies[0].proxy }, state: stateProxy.proxy }, {});
  const work = createGraphPresentationSnapshotWork(input(presentation.proxy));
  const result = finish(work, 7), before = snapshot(result.value);
  palette[0] = '#ffffff'; selected.push(99); dimmed.length = 0; state.hover = 22;
  for (const proxy of [...proxies, stateProxy, presentation]) proxy.revoke();
  work.dispose(); assert.deepEqual(snapshot(result.value), before); assert.throws(() => work.step(1), invalidState);
});

test('snapshot creation never eagerly constructs a Set from caller contents or calls palette bulk methods', () => {
  const palette = new Proxy(['#123456', '#abcdef'], { get(target, key, receiver) {
    assert.ok(key === 'length' || typeof key === 'string' && /^\d+$/.test(key)); return Reflect.get(target, key, receiver);
  }, ownKeys() { assert.fail('palette enumeration is not a row operation'); } });
  const source = input({ style: { palette }, state: { selected: [1, 2, 1], dimmed: [2], hover: -1, focus: 1 } });
  const work = createGraphPresentationSnapshotWork(source), OriginalSet = Set, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Set');
  const GuardedSet = new Proxy(OriginalSet, { construct(target, args, newTarget) {
    assert.ok(args.length === 0 || args[0] === undefined || args[0] === null, 'Set contents must be copied by the cursor');
    return Reflect.construct(target, args, newTarget);
  } });
  withProperty(globalThis, 'Set', { ...descriptor, value: GuardedSet }, () => {
    try { counts(finish(work, 1), 2, 4); } finally { work.dispose(); }
  });
});

test('palette descriptor and content traps fence cancellation before another input read', () => {
  for (const boundary of ['descriptor', 'length', 'has', 'get']) for (const mode of ['dispose', 'stale', 'reenter']) {
    let current = true, work, triggered = false, readsAfter = 0;
    const hit = kind => {
      if (triggered && mode !== 'reenter') readsAfter++;
      if (kind !== boundary || triggered) return;
      triggered = true;
      if (mode === 'dispose') work.dispose(); else if (mode === 'stale') current = false; else assert.throws(() => work.step(0), invalidState);
    };
    const palette = new Proxy(['#123456', '#abcdef'], {
      get(target, key, receiver) { hit(key === 'length' ? 'length' : 'get'); return Reflect.get(target, key, receiver); },
      has(target, key) { hit('has'); return Reflect.has(target, key); },
    });
    const style = new Proxy({ palette }, { getOwnPropertyDescriptor(target, key) { hit('descriptor'); return Reflect.getOwnPropertyDescriptor(target, key); } });
    work = createGraphPresentationSnapshotWork(input({ style }), () => current);
    try {
      if (mode === 'reenter') counts(finish(work, 1), 2, 0);
      else assert.throws(() => finish(work, 1), mode === 'stale' ? { name: 'AbortError' } : aborted);
      assert.equal(triggered, true); assert.equal(readsAfter, 0);
    } finally { work.dispose(); }
  }
});

const number = fc.oneof(fc.integer({ min: -100, max: 500 }), fc.constantFrom(-0, NaN, Infinity, -Infinity));
const rgba = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }));
const cssHex = channels => `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
const rgbValue = channels => ({ r: channels[0] / 255, g: channels[1] / 255, b: channels[2] / 255, a: channels[3] / 255 });
const clamp = (value, fallback, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
function uniqueNumbers(values) {
  const result = [];
  for (const value of values) if (!result.some(previous => previous === value || Number.isNaN(previous) && Number.isNaN(value))) result.push(value === 0 ? 0 : value);
  return result;
}
test('generated styles and numeric state follow independent math, order and exact operation counts', () => {
  fc.assert(fc.property(fc.record({ foreground: rgba, palette: fc.array(fc.option(rgba, { nil: null }), { maxLength: 12 }),
    fontSize: number, pointSize: number, lineWidth: number, devicePixelRatio: number, forcedColors: fc.boolean(), reducedMotion: fc.boolean(),
    selected: fc.array(number, { maxLength: 15 }), dimmed: fc.array(number, { maxLength: 15 }), hover: number, focus: number }), value => {
    const rawStyle = { foreground: cssHex(value.foreground), palette: value.palette.map(color => color ? cssHex(color) : 'bad'),
      fontFamily: '  generated serif  ', fontSize: value.fontSize, pointSize: value.pointSize, lineWidth: value.lineWidth,
      devicePixelRatio: value.devicePixelRatio, forcedColors: value.forcedColors, reducedMotion: value.reducedMotion };
    const rawState = { selected: value.selected, dimmed: value.dimmed, hover: value.hover, focus: value.focus };
    const palette = value.palette.filter(Boolean).map(rgbValue);
    const expected = { style: { ...STYLE_ORACLES.defaults, foreground: rgbValue(value.foreground), palette: palette.length ? palette : STYLE_ORACLES.defaults.palette,
      fontFamily: 'generated serif', fontSize: clamp(value.fontSize, 12, 1, 256), pointSize: clamp(value.pointSize, 6, 0, 1024),
      lineWidth: clamp(value.lineWidth, 1, 0, 64), devicePixelRatio: clamp(value.devicePixelRatio, 1, 0.25, 4),
      forcedColors: value.forcedColors, reducedMotion: value.reducedMotion },
      state: { selected: uniqueNumbers(value.selected).map(encode), dimmed: uniqueNumbers(value.dimmed).map(encode), hover: encode(value.hover), focus: encode(value.focus) },
      inheritsStyle: false, inheritsState: false };
    for (const budget of [1, 7, 4096]) {
      const work = createGraphPresentationSnapshotWork(input({ style: rawStyle, state: rawState }));
      try {
        const result = finish(work, budget); counts(result, value.palette.length, value.selected.length + value.dimmed.length);
        assert.deepEqual(snapshot(result.value), expected);
      } finally { work.dispose(); }
    }
  }), { seed: 20261029, numRuns: 200 });
});
