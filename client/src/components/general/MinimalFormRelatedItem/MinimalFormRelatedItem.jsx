import React, { useRef, useState, useEffect } from 'react';
import { IoIosArrowRoundForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';
import './MinimalFormRelatedItem.css';

const MinimalFormRelatedItem = ({ Icon, description, title, to }) => {
    const itemRef = useRef(null);
    const [isHover, setIsHover] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if(!itemRef.current) return;
        const mouseEnterHandler = () => {
            setIsHover(true);
        };
        const mouseLeaveHandler = () => {
            setIsHover(false);
        };
        itemRef.current.addEventListener('mouseenter', mouseEnterHandler);
        itemRef.current.addEventListener('mouseleave', mouseLeaveHandler);
    }, [itemRef]);

    return (
        <div className='Minimal-Form-Related-Item' ref={itemRef} onClick={() => navigate(to)}>
            <div className='Minimal-Form-Related-Item-Header-Container'>
                <i className='Minimal-Form-Related-Item-Header-Icon-Container'>
                    <Icon />
                </i>
            </div>
            <div className='Minimal-Form-Related-Item-Footer-Container'>
                <div className='Minimal-Form-Related-Item-Footer-Left-Container'>
                    {isHover ? (
                        <p className='Minimal-Form-Related-Item-Footer-Left-Description'>{description}</p>
                    ) : (
                        <h4 className='Minimal-Form-Related-Item-Footer-Left-Title'>{title}</h4>
                    )}
                </div>
                <div className='Minimal-Form-Related-Item-Footer-Right-Container'>
                    <i className='Minimal-Form-Related-Item-Footer-Right-Icon-Container'>
                        <IoIosArrowRoundForward />
                    </i>
                </div>
            </div>
        </div>
    );
};

export default MinimalFormRelatedItem;